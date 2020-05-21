/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.03.2020
 *
 *  A WebGL recreation of Halo 3's Loading Screen.
 *  
 *  This program was built atop a simple GPU-based particle shader program
 *  provided by Dr. Henry Kang in UMSL's Topics in Computer Graphics course.
 *  We stand on the shoulders of giants.
 */ 



/*--- Global Configuration ---*/

let config = {
    LENGTH_LOOP:80000,                         // Length of full animation (Final = 75000)
	LENGTH_START_DELAY: 600,                   // Time between full canvas visibility and animation start
	LENGTH_ASSEMBLY_DELAY: 2000,               // Time between animation start and ring assembly start
	LENGTH_RING_ASSEMBLY: 71000,               // Final = 66000
	LENGTH_SLICE_ASSEMBLY: 25,
	LENGTH_PARTICLE_FADE: 1000,                // Length of each particle's fade-in
	LENGTH_SCENE_FADE: 1500,                   // Length of scene fade-out
	LENGTH_CANVAS_FADE: 2000,                  // Length of canvas fade-in
	RESOLUTION_SCALE: 1.0,                     // Default: 1080p
	BACKGROUND_COLOR: [0.1, 0.115, .15, 1.0],
    RING_SLICES: 1950,                         // Final = 1950
    RING_RADIUS: 3,
    AMBIENT_PARTICLES: 20000,
    AMBIENT_WIDTH: 4,                          // Horizontal area in which ambient particles are rendered
    AMBIENT_HEIGHT: 1.2,                       // Vertical area in which ambient particles are rendered
    AMBIENT_DRIFT: 0.8,                        // Speed at which ambient particles randomly move
    SLICE_PARTICLES: 66,                       // Must be even & match particle offset generation function below
    SLICE_SIZE: 0.006,                         // Distance between slice particles
    SLICE_WIDTH: 4,                            // Number of particles on top and bottom edges of ring
    SLICE_HEIGHT: NaN,                         // Calculated below: ((SLICE_PARTICLES / 2) - SLICE_WIDTH) + 1
    TEXTURE_SIZE: NaN,                         // Calculated below: ceiling(sqrt(RING_SLICES * SLICE_PARTICLES))
    PARTICLE_SIZE: 2.4,
    PARTICLE_WAIT_VARIATION: 250,              // Amount of random flux in particle wait
    PARTICLE_SIZE_CLAMP: false,                // Whether to clamp max particle size when particle scaling enabled
    CAMERA_DIST_MAX: 14,                       // Maximum distance particles are expected to be from camera
    CAMERA_DIST_FACTOR: 1.65,                  // Multiplier for camera-position dependent effects
    ENABLE_DEVELOPER_CAMERA: false,            // Places camera statically perpindicular to first slice
    ENABLE_PARTICLE_SCALING: true,             // Whether particle size changes based on distance from camera
    ENABLE_ALPHA_SCALING: true                 // Whether particle alpha changes based on distance from camera
}

// Generated Global Initialization
config.PARTICLE_SIZE = config.PARTICLE_SIZE * config.RESOLUTION_SCALE;
config.TEXTURE_SIZE = Math.ceil(Math.sqrt(config.RING_SLICES * config.SLICE_PARTICLES + config.AMBIENT_PARTICLES));
if (config.SLICE_WIDTH == config.SLICE_PARTICLES) config.SLICE_HEIGHT = 1;
else if (config.SLICE_WIDTH == config.SLICE_PARTICLES / 2) config.SLICE_HEIGHT = 2;
else config.SLICE_HEIGHT = ((config.SLICE_PARTICLES / 2) - config.SLICE_WIDTH) + 2;



/*--- Variable Declarations ---*/

let gl, canvas;
let g_proj_mat = new Matrix4();
let g_light_dir = new Vector3([0, 0.4, 0.6]);
let g_model_mat = new Matrix4();
let g_view_mat = new Matrix4();

let vao_image;                  // vao for drawing image (using 2 triangles)

let uv_coord_data_buffer;       // Contains UV coordinates for each pixel in particle data textures 

let prog_particle;              // Particle Renderer
let prog_display;               // FBO Renderer
let prog_position;              // Particle Position Updater
let prog_data;                  // Particle Data Updater

let fbo_pos_initial;            // Particle Initial Position
let fbo_pos_swerve;             // Particle Swerve Position
let fbo_pos_final;              // Particle Final Position
let fbo_pos;                    // Particle Position
let fbo_data_dynamic;           // Changing Particle Metadata
let fbo_data_static;            // Unchanging Particle Metadata

let camera_pos = [];
let camera_pos_control_points = [
    [-2.4, -0.2, 1.8],
    [-2.1,  .05, 3.0],
    [  .5,  .15, 5.2],
    [ 2.2,  .25,   2],
    [ 2.5, 0.15,   1]
];
let camera_pos_interpolator = new Interpolator(camera_pos_control_points);
let camera_focus = [];
let camera_focus_control_points = [
    [  -3,    0,   0],
    [-2.1,    0, 3.3],
    [ 2.8, -.02, 3.3],
    [   3,  -.1, -.5]
];
let camera_focus_interpolator = new Interpolator(camera_focus_control_points);
let start_time, time;
var canvas_opacity = 0;



/*--- Shader Definitions ---*/


const vertex_display = `#version 300 es
	in vec2 a_position;	
	out vec2 v_coord;

	void main() {
		gl_Position = vec4(a_position, 0.0, 1.0); // 4 corner vertices of quad
		v_coord = a_position * 0.5 + 0.5; // UV coords: (0, 0), (0, 1), (1, 1), (1, 0)
	}
`;

let frag_position = `#version 300 es
	precision highp float;

    // Input Variables
    uniform sampler2D texture_initial_position;
    uniform sampler2D texture_swerve_position;
	uniform sampler2D texture_final_position;
	uniform sampler2D texture_position;
	uniform sampler2D texture_data_static;
	uniform float time;
	uniform float length_loop;
	uniform float length_start_delay;
	uniform float length_assembly_delay;
	uniform float length_ring_assembly;
	uniform float length_slice_assembly;
	in vec2 v_coord; // UV coordinate of current point.

    // Output Variables
	out vec4 cg_FragColor;

    // Procedural Float Generator [-1, 1]
    // Note: Consistently returns the same pseudo-random float for the same two input values.  
	float generate_float(float value_one, float value_two) {
	    float seed_one = 78.0;
	    float seed_two = 13647.0;
	    float magnitude = (mod(floor(value_one * seed_one + value_two * seed_two), 100.0) / 100.0) * 2.0 - 1.0;
	    return magnitude;
	}

	// 3-Point Curve Interpolator
	// Note: Returns a position in 3D space representing a particle's location on
	//       a smooth bezier curve between three points given factor t [0-1]. 
	// Source: https://forum.unity.com/threads/getting-a-point-on-a-bezier-curve-given-distance.382785/ 
	vec4 interpolate_location(vec4 v1, vec4 v2, vec4 v3, float t) {
         float x = (((1.0 - t) * (1.0 - t)) * v1.x) + (2.0 * t * (1.0 - t) * v2.x) + ((t * t) * v3.x);
         float y = (((1.0 - t) * (1.0 - t)) * v1.y) + (2.0 * t * (1.0 - t) * v2.y) + ((t * t) * v3.y);
         float z = (((1.0 - t) * (1.0 - t)) * v1.z) + (2.0 * t * (1.0 - t) * v2.z) + ((t * t) * v3.z);
         return vec4(x, y, z, 1.0);
	}

	void main() {

		// Local Variables
		vec4 initial_position = texture(texture_initial_position, v_coord);
		vec4 swerve_position = texture(texture_swerve_position, v_coord);
		vec4 final_position = texture(texture_final_position, v_coord);
		vec4 current_position = texture(texture_position, v_coord);
		float wait = texture(texture_data_static, v_coord).r;
		float seed = texture(texture_data_static, v_coord).g;
		float ambient = texture(texture_data_static, v_coord).b;
		float temp = mod(time, length_start_delay + length_loop);
		float delay_time = max(temp - length_start_delay, 0.0);

        if (ambient != 1.0) {

        	// Calculate Ring Particle Animation Factor
			float factor = 0.0;
			if (delay_time > wait) {
				factor = min((delay_time - wait - length_assembly_delay) / length_slice_assembly, 1.0);
			}

			// Find Current Position Along Curve
			vec4 position = interpolate_location(initial_position, swerve_position, final_position, factor);

			cg_FragColor = position;
        
        } else {

        	// Calculate Ambient Particle Animation Factor
			float factor = min(delay_time / length_loop, 1.0);

            // Apply Particle Drift
        	cg_FragColor = vec4(
                initial_position[0] + (final_position[0] * factor),
                initial_position[1] + (final_position[1] * factor),
                initial_position[2] + (final_position[2] * factor),
                1.0
        	);
        }
	}
`;

let frag_data = `#version 300 es
	precision mediump float;

    // Input Variables
    uniform sampler2D texture_position;
	uniform sampler2D texture_data_dynamic;
	uniform sampler2D texture_data_static;
	uniform vec3 position_camera;
	uniform float time;
	uniform float length_loop;
	uniform float length_start_delay;
	uniform float length_particle_fade;
	uniform float length_scene_fade;
	uniform float camera_dist_max;
	uniform float camera_dist_factor;
	uniform float alpha_fade;
	in vec2 v_coord;

    // Output Variables
	out vec4 cg_FragColor; 

	void main() {

		// Local Variables
		vec4 position = texture(texture_position, v_coord);
		float alpha = texture(texture_data_dynamic, v_coord).r;
		float brightness = texture(texture_data_dynamic, v_coord).g;
        float wait = texture(texture_data_static, v_coord).r;
        float seed = texture(texture_data_static, v_coord).g;
        float ambient = texture(texture_data_static, v_coord).b;
		float temp = mod(time, length_start_delay + length_loop);
		float delay_time = max(temp - length_start_delay, 0.0);
		float distance = abs(distance(position, vec4(position_camera[0], position_camera[1], position_camera[2], 1.0)));

        // Calculate & Set Alpha Scale
 		float alpha_scale = 1.0;
 		if (alpha_fade == 1.0) {
            alpha_scale = 1.0 - ((distance * camera_dist_factor) / camera_dist_max);
        }

        // Adjust Alpha for Camera Clipping
        float camera_distance_min = 0.05;
 		float camera_distance_min_fade = .5;
 		float factor = (distance - camera_distance_min) / (camera_distance_min_fade - camera_distance_min);
 		factor = min(max(factor, 0.0), 1.0);
        alpha_scale *= factor;

        // Calculate & Set Alpha
        alpha = 0.0;
		if (delay_time > length_loop - length_scene_fade) {
			alpha = max((length_loop - delay_time) / length_scene_fade, 0.0) * alpha_scale;
		} else if (delay_time > wait) {
			alpha = min((delay_time - wait) / length_particle_fade, 1.0) * alpha_scale;
		}
		    
        cg_FragColor = vec4(alpha, brightness, 1.0, 1.0);
	}	
`;

let vertex_particle = `#version 300 es

    // Input Variables
    in vec2 uv_coord_data;
    uniform mat4 u_proj_mat;
	uniform mat4 u_model_mat;
	uniform mat4 u_view_mat;
	uniform sampler2D u_pos;
	uniform sampler2D texture_data_static;
	uniform float particle_size;
	uniform float particle_scaling;
	uniform float particle_size_clamp;
	uniform float camera_dist_max;
	uniform float camera_dist_factor;
	uniform vec3 position_camera;

    // Output Variables
	out vec2 uv_coord_data_frag;

	void main() {

		// Local Variables
		vec4 pos = texture(u_pos, uv_coord_data); // this particle position
		float ambient = texture(texture_data_static, uv_coord_data).b;
		gl_Position = u_proj_mat * u_view_mat * pos;

        // Scale Particles Based on Camera Distance
        if (particle_scaling == 1.0) {
        	float distance = distance(pos, vec4(position_camera[0], position_camera[1], position_camera[2], 1.0));
		    gl_PointSize = particle_size * (1.0 / (distance));
		    if (particle_size_clamp == 1.0) gl_PointSize = min(gl_PointSize, particle_size);
        } else {
        	gl_PointSize = particle_size;
        }

        // Scale Up Ambient Particles
        float ambient_particle_scale = 2.5;
        float active_particle_scale = .25;
        if (ambient == 1.0) {
        	gl_PointSize += gl_PointSize * ambient_particle_scale;
        } else {
        	gl_PointSize += gl_PointSize * active_particle_scale;
        }

        // Send UV Coordinates to Fragment Shader
        uv_coord_data_frag = uv_coord_data;
    }
`;

let frag_particle = `#version 300 es
	precision highp float;

    // Input Variables
    in vec2 uv_coord_data_frag;
    uniform sampler2D texture_data_dynamic;
    uniform sampler2D texture_data_static;

    // Output Variables
	out vec4 cg_FragColor; 

	void main() {

		// Local Variables
		float alpha = texture(texture_data_dynamic, uv_coord_data_frag).r;
		float ambient = texture(texture_data_static, uv_coord_data_frag).b;
		vec3 color = vec3(0.51, 0.8, 1.0);

        // Calculate Particle Transparency
		if (ambient == 1.0) {
			vec2 location = (gl_PointCoord - 0.5) * 2.0;
			float distance = (1.0 - sqrt(location.x * location.x + location.y * location.y));
			cg_FragColor = vec4(color.x, color.y, color.z, alpha * (distance / 3.5));
		} else {
			cg_FragColor = vec4(color.x, color.y, color.z, alpha);
		}
	}
`;

/*--- Main Program ---*/

function main () {

    /* Render Preparation */

	// Retrieve Canvas
	canvas = document.getElementById('canvas');

	// Get & Configure Rendering Context
	gl = canvas.getContext('webgl2');
    gl.clearColor(
        config.BACKGROUND_COLOR[0],
        config.BACKGROUND_COLOR[1],
        config.BACKGROUND_COLOR[2],
        config.BACKGROUND_COLOR[3]);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set Render Resolution
	canvas.width  = 1920 * config.RESOLUTION_SCALE;
    canvas.height = 1080 * config.RESOLUTION_SCALE;

    // Create Rendering Programs
	prog_position = new GLProgram(vertex_display, frag_position);
    prog_data = new GLProgram(vertex_display, frag_data);
    prog_particle = new GLProgram(vertex_particle, frag_particle);
	prog_particle.bind();

    // Set Up Camera
    if (config.ENABLE_DEVELOPER_CAMERA) {

    	// Define Developer Camera Position
        camera_pos[0] = 0;
        camera_pos[1] = .3;
        camera_pos[2] = 4.9;

        // Define Developer Camera View Matrix
    	g_proj_mat.setPerspective(50, canvas.width/canvas.height, .02, 10000);
    	// LookAt Parameters: camera pos, focus pos, up vector      
        g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], 0, 0, 0, 0, 1, 0);

    } else {

    	// Define Standard Initial Position
        camera_pos[0] = 0;
        camera_pos[1] = 0;
        camera_pos[2] = 0;

	    // Define Standard View Matrix
        g_proj_mat.setPerspective(50, canvas.width/canvas.height, .02, 10000);
        // LookAt Parameters: camera pos, focus pos, up vector     
	    g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], 0, 0, 0, 0, 1, 0);
    }

    // Generate Loading Particles
    let loadingParticleFactory = new LoadingParticleFactory(config);
	let pa = loadingParticleFactory.generateLoadingParticles();

    // Create Buffers (Define Input Coordinates for Shaders)
   	create_vertex_buffer();
   	initialize_buffers(prog_particle); 
	populate_buffers(pa);

    // Set Up Framebuffer Objects (Hold Particle Data Textures)
	initialize_framebuffer_objects();
	populate_framebuffer_objects(pa);

	// Send Variables to Particle Program
	gl.uniformMatrix4fv(prog_particle.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1i(prog_particle.uniforms.u_sampler, 0);
	gl.uniform1i(prog_particle.uniforms.texture_data_static, fbo_data_static.read.attach(1));
    gl.uniform1f(prog_particle.uniforms.particle_size, config.PARTICLE_SIZE);
    gl.uniform3fv(prog_particle.uniforms.position_camera, camera_pos);
    gl.uniform1f(prog_particle.uniforms.particle_scaling, config.ENABLE_PARTICLE_SCALING ? 1 : 0);
    gl.uniform1f(prog_particle.uniforms.particle_size_clamp, config.PARTICLE_SIZE_CLAMP ? 1 : 0);

    
    /*-- Preparation Complete --*/

	// Set Time Start
	start_time = performance.now();

	// Fade To Canvas
	fade_to_canvas();
	function fade_to_canvas() {
	   if (canvas_opacity < 1) {
		  canvas_opacity += 0.1;
		  setTimeout(function(){fade_to_canvas()}, 1000 / 60);
		  canvas.style.opacity = canvas_opacity;
		  document.getElementById("loading").style.opacity = 1 - canvas_opacity;
	   }
	}

    // Begin Update Loop
	let update = function() {

		// Update Time
		time = performance.now() - start_time;
		
        // Clear Canvas
		gl.clear(gl.COLOR_BUFFER_BIT);

        // Update Camera
        if (!config.ENABLE_DEVELOPER_CAMERA) {

            // Calculate Camera Loop Factor
            let base_time = time % (config.LENGTH_START_DELAY + config.LENGTH_LOOP);
		    let delay_time = Math.max(base_time - config.LENGTH_START_DELAY, 0.0);
            let loop_factor = Math.min(delay_time / config.LENGTH_LOOP, 1.0);

        	// Update Camera Positions
			camera_pos = camera_pos_interpolator.getInterpolatedPoint(loop_factor);
			camera_focus = camera_focus_interpolator.getInterpolatedPoint(loop_factor);

			// Update View Matrix
			g_view_mat.setLookAt(
			    camera_pos[0],
			    camera_pos[1],
			    camera_pos[2],
			    camera_focus[0],
			    camera_focus[1],
			    camera_focus[2],
			    0,
			    1,
			    0
			);
			gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
			gl.uniform3fv(prog_particle.uniforms.position_camera, camera_pos);
			gl.uniform1f(prog_particle.uniforms.particle_scaling, config.ENABLE_PARTICLE_SCALING ? 1 : 0);
        }

        // Render Scene
		update_particle_positions(fbo_pos_initial, fbo_pos_swerve, fbo_pos_final, fbo_pos, fbo_data_static);
		update_particle_data(fbo_pos, fbo_data_dynamic, fbo_data_static);
	    draw_particles(fbo_pos, fbo_data_dynamic, fbo_data_static, pa);

		requestAnimationFrame(update);
	};
	update();
}


/*--- Shader Program Class ---*/

class GLProgram {
    constructor (vertex_shader, fragment_shader) {
        this.attributes = {};
        this.uniforms = {};

        // Note: Method defined in cuon-utils.js.
        this.program = createProgram(gl, vertex_shader, fragment_shader);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw gl.getProgramInfoLog(this.program);
        
        // Register Attribute Variables
        const attribute_count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < attribute_count; i++) {
            const attribute_name = gl.getActiveAttrib(this.program, i).name;
            this.attributes[attribute_name] = gl.getAttribLocation(this.program, attribute_name);
        }

        // Register Uniform Variables
        const uniform_count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniform_count; i++) {
            const uniform_name = gl.getActiveUniform(this.program, i).name;
            this.uniforms[uniform_name] = gl.getUniformLocation(this.program, uniform_name);
        }
    }

    bind () {
        gl.useProgram(this.program);
    }

    bind_time() {
    	gl.useProgram(this.program);
        gl.uniform1f(this.uniforms.time, time);
    }
}


/*--- Buffer Setup ---*/

// Note: This VertexArrayObject is used to draw to each square data texture.
function create_vertex_buffer () {

	// Create Vertex Array Object
    vao_image = gl.createVertexArray();
    gl.bindVertexArray(vao_image);

    // Create Vertex Buffer
    let vertex_buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            -1, -1,
            -1, 1,
            1, 1,
            1, -1
        ]),
        gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(prog_particle.uniforms.a_position);

    // Create Vertex Element Buffer (Specifies Shared Vertices by Index)
    let vertex_element_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertex_element_buffer);
    // Note: Six vertices representing two triangles with a shared edge from bottom left to top right 
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    
    // Unbind
    gl.bindVertexArray(null);
}

function initialize_buffers (prog) {

    // Initialize Particle Data Buffer
  	uv_coord_data_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uv_coord_data_buffer);
	gl.vertexAttribPointer(prog.attributes.uv_coord_data, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(prog.attributes.uv_coord_data);

}

// Note: Calculations involving tiny decimals require special care
//       because JavaScript's math is broken. In this case, operations
//       on decimals representing the width of single pixels intermittently
//       produce the wrong result due to floating point errors. To work
//       around the issue, this method uses the arbitrary-precision decimal
//       library decimal.js.
// Source: https://github.com/MikeMcl/decimal.js/
function populate_buffers(pa) {


    /*-- Particle Data Buffer --*/

    // Note: This block calculates the UV coordinates for each pixel of the images
    //       representing a particle's data (initial pos, final pos, pos, etc). Values
    //       are in range [0, 1]. The coordinates are sent to the vertex_particle shader
    //       as uv_coord_data.

    // Declare Variables
    let uv_coord_data = [];
    let pixel_size = (new Decimal(1.0)).dividedBy(new Decimal(config.TEXTURE_SIZE)); // 1 / TEXTURE_SIZE
    let half_pixel_size = pixel_size.dividedBy(new Decimal(2)); // pixel_size / 2

    // Generate Texture Coordinates for Each Pixel
    for (let x = 0; x < config.TEXTURE_SIZE; x++) {
    	for (let y = 0; y < config.TEXTURE_SIZE; y++) {
    		let coord_x = pixel_size.times(new Decimal(x).plus(half_pixel_size)).toPrecision(10);
    		let coord_y = pixel_size.times(new Decimal(y).plus(half_pixel_size)).toPrecision(10);
		    uv_coord_data.push(coord_x);
		    uv_coord_data.push(coord_y);
    	}
    }

    // Send UV Coordinates to GPU
	gl.bindBuffer(gl.ARRAY_BUFFER, uv_coord_data_buffer);    
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv_coord_data), gl.STATIC_DRAW);
}

function initialize_framebuffer_objects() {

    // Enables float framebuffer color attachment
    gl.getExtension('EXT_color_buffer_float');

    fbo_pos_initial = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_pos_swerve = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_pos_final = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_pos = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_data_dynamic = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
    fbo_data_static = create_double_framebuffer_object(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);

}

function populate_framebuffer_objects (pa) {

	// Initialize Texture Arrays
	let position_initial = [];
	let position_swerve = [];
	let position_final = [];
	let position = [];
	let data_dynamic = [];
	let data_static = [];

	for (let i = 0; i < pa.length; i++) {

		// Initial Position
		position_initial.push(pa[i].position_initial[0]);
		position_initial.push(pa[i].position_initial[1]);
		position_initial.push(pa[i].position_initial[2]);
		position_initial.push(1);

		// Swerve Position
		position_swerve.push(pa[i].position_swerve[0]);
		position_swerve.push(pa[i].position_swerve[1]);
		position_swerve.push(pa[i].position_swerve[2]);
		position_swerve.push(1);

        // Final Position
		position_final.push(pa[i].position_final[0]);
		position_final.push(pa[i].position_final[1]);
		position_final.push(pa[i].position_final[2]);
		position_final.push(1);

        // Current Position
		position.push(pa[i].position[0]);
		position.push(pa[i].position[1]);
		position.push(pa[i].position[2]);
		position.push(1);

        // Changing Particle Data
		data_dynamic.push(pa[i].alpha);
		data_dynamic.push(pa[i].brightness);
		data_dynamic.push(1);
		data_dynamic.push(1);

		// Unchanging Particle Data
		data_static.push(pa[i].wait);
		data_static.push(pa[i].seed);
		data_static.push(pa[i].ambient);
		data_static.push(1);

	}
    
    // Add Textures to Framebuffer Objects
	fbo_pos_initial.read.addTexture(new Float32Array(position_initial));
	fbo_pos_swerve.read.addTexture(new Float32Array(position_swerve));
	fbo_pos_final.read.addTexture(new Float32Array(position_final));
	fbo_pos.read.addTexture(new Float32Array(position));
	fbo_data_dynamic.read.addTexture(new Float32Array(data_dynamic));
	fbo_data_static.read.addTexture(new Float32Array(data_static));
}

function create_framebuffer_object (w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    // create texture image of resolution (w x h)
    // note that here we pass null as texture source data (no texture image source)
    // For this texture, we're only allocating memory and not actually filling it.
    // Filling texture will happen as soon as we render to the framebuffer.    
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    // attach texture to framebuffer so from now on, everything will be 
    // drawn on this texture image    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); 
    // back to system framebuffer
	
    let texel_x = 1.0 / w;
    let texel_y = 1.0 / h;

    return {
        texture,
        fbo,
        single: true,
        width: w,
        height: h,
        texel_x,
        texel_y,
        internalFormat,
        format,
        type,
        attach(id) {
            gl.activeTexture(gl.TEXTURE0 + id);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return id;
        },
        addTexture(pixel) {
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);// do not flip the image's y-axis
			gl.bindTexture(gl.TEXTURE_2D, texture); // bind TEXTURE_2D to this FBO's texture 
			gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, gl.FLOAT, pixel);
        }
    };
}

function create_double_framebuffer_object (w, h, internalFormat, format, type, param, depth) {
    let fbo1 = create_framebuffer_object(w, h, internalFormat, format, type, param, depth);
    let fbo2 = create_framebuffer_object(w, h, internalFormat, format, type, param, depth);

    let texel_x = 1.0 / w;
    let texel_y = 1.0 / h;

    return {
        width: w,
        height: h,
        single: false,
        texel_x,
        texel_y,
        get read() {
            return fbo1;
        },
        set read(value) {
            fbo1 = value;
        },
        get write() {
            return fbo2;
        },
        set write(value) {
            fbo2 = value;
        },
        swap() {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    }
}



/*--- Draw Methods ---*/

function update_particle_positions (position_initial, position_swerve, position_final, position, data_static) {
    let program = prog_position;
    program.bind();

    gl.uniform1i(program.uniforms.texture_initial_position, position_initial.read.attach(1));
    gl.uniform1i(program.uniforms.texture_swerve_position, position_swerve.read.attach(2));
    gl.uniform1i(program.uniforms.texture_final_position, position_final.read.attach(3));
    gl.uniform1i(program.uniforms.texture_position, position.read.attach(4));
    gl.uniform1i(program.uniforms.texture_data_static, data_static.read.attach(5));

    gl.uniform1f(program.uniforms.time, time);
    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_assembly_delay, config.LENGTH_ASSEMBLY_DELAY);
    gl.uniform1f(program.uniforms.length_ring_assembly, config.LENGTH_RING_ASSEMBLY);
    gl.uniform1f(program.uniforms.length_slice_assembly, config.LENGTH_SLICE_ASSEMBLY);
    gl.uniform1f(program.uniforms.camera_dist_max, config.CAMERA_DIST_MAX);
    gl.uniform1f(program.uniforms.camera_dist_factor, config.CAMERA_DIST_FACTOR);

    gl.viewport(0, 0, position.width, position.height);
 
    draw_to_framebuffer_object(position.write.fbo);
    position.swap();
}

function update_particle_data (position, data_dynamic, data_static) {
    let program = prog_data;
    program.bind();

    gl.uniform1i(program.uniforms.texture_position, position.read.attach(1));
    gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.read.attach(2));
    gl.uniform1i(program.uniforms.texture_data_static, data_static.read.attach(3));

    gl.uniform3fv(program.uniforms.position_camera, camera_pos);
    gl.uniform1f(program.uniforms.time, time);
    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_particle_fade, config.LENGTH_PARTICLE_FADE);
    gl.uniform1f(program.uniforms.length_scene_fade, config.LENGTH_SCENE_FADE);
    gl.uniform1f(program.uniforms.camera_dist_max, config.CAMERA_DIST_MAX);
    gl.uniform1f(program.uniforms.camera_dist_factor, config.CAMERA_DIST_FACTOR);
    gl.uniform1f(program.uniforms.alpha_fade, config.ENABLE_ALPHA_SCALING ? 1 : 0); 

    gl.viewport(0, 0, data_dynamic.width, data_dynamic.height);
 
    draw_to_framebuffer_object(data_dynamic.write.fbo);
    data_dynamic.swap(); 
}

function draw_to_framebuffer_object (fbo) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  	gl.bindVertexArray(vao_image);
    
    // Draw Trangles Using 6 Vertices
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    // Unbind
    gl.bindVertexArray(null);
}

function draw_particles (position, data_dynamic, data_static, pa) {
    let program = prog_particle;
    program.bind();

    gl.uniform1i(program.uniforms.u_pos, position.read.attach(1));
    gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.read.attach(2));
    gl.uniform1i(program.uniforms.texture_data_static, data_static.read.attach(3));
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	gl.viewport(0, 0, canvas.width, canvas.height);

	gl.drawArrays(gl.POINTS, 0, pa.length);
}