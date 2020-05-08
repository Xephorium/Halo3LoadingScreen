/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.03.2020
 *
 *  This program is a heavily modified version of a GPU-based particle shader
 *  provided by Dr. Henry Kang in UMSL's Topics in Computer Graphics course.
 *
 *  We stand on the shoulders of giants.
 */ 


/*--- Global Configuration ---*/

let config = {
    LENGTH_LOOP:72000,                         // Length of full animation
	LENGTH_START_DELAY: 800,
	LENGTH_RING_ASSEMBLY: 63000,
	LENGTH_SLICE_ASSEMBLY: 1500,
	LENGTH_PARTICLE_FADE: 1000,                // Length of each particle's fade-in
	LENGTH_SCENE_FADE: 1500,                   // Length of scene fade-out
	RESOLUTION_SCALE: 1.0,                     // Default: 1080p
	BACKGROUND_COLOR: [0.1, 0.115, .15, 1.0],
    RING_SLICES: 1500,                         // Final = 2096
    RING_RADIUS: 3.5,
    AMBIENT_PARTICLES: 10000,
    AMBIENT_WIDTH: 7,                          // Horizontal area in which ambient particles are rendered
    AMBIENT_HEIGHT: 3.5,                       // Vertical area in which ambient particles are rendered
    AMBIENT_DRIFT: .001,                       // Speed at which ambient particles randomly move
    SLICE_PARTICLES: 52,                       // Must be even
    SLICE_SIZE: 0.006,                         // Distance between slice particles
    SLICE_WIDTH: 4,                            // Number of particles on top and bottom edges of ring
    SLICE_HEIGHT: NaN,                         // Calculated below: ((SLICE_PARTICLES / 2) - SLICE_WIDTH) + 1
    TEXTURE_SIZE: NaN,                         // Calculated below: ceiling(sqrt(RING_SLICES * SLICE_PARTICLES))
    PARTICLE_SIZE: 2.5,
    PARTICLE_WAIT_VARIATION: 250,              // Amount of random flux in particle wait
    PARTICLE_SIZE_CLAMP: false,                // Whether to clamp max particle size when particle scaling enabled
    CAMERA_DIST_MAX: 14,                       // Maximum distance particles are expected to be from camera
    CAMERA_DIST_FACTOR: 1.7,                   // Multiplier for camera-position dependent effects
    ENABLE_SLICE_INSPECTION: false,            // Places camera statically perpindicular to first slice
    ENABLE_PARTICLE_SCALING: true,             // Whether particle size changes based on distance from camera
    ENABLE_ALPHA_SCALING: true                 // Whether particle alpha changes based on distance from camera
}
config.PARTICLE_SIZE = config.PARTICLE_SIZE * config.RESOLUTION_SCALE;
config.TEXTURE_SIZE = Math.ceil(Math.sqrt(config.RING_SLICES * config.SLICE_PARTICLES + config.AMBIENT_PARTICLES));
if (config.SLICE_WIDTH == config.SLICE_PARTICLES) config.SLICE_HEIGHT = 1;
else if (config.SLICE_WIDTH == config.SLICE_PARTICLES / 2) config.SLICE_HEIGHT = 2;
else config.SLICE_HEIGHT = ((config.SLICE_PARTICLES / 2) - config.SLICE_WIDTH) + 2;


/*--- Shader Declarations ---*/

let frag_position = `#version 300 es
	precision highp float;

    // Input Variables
    uniform sampler2D texture_initial_position;
	uniform sampler2D texture_final_position;
	uniform sampler2D texture_position;
	uniform sampler2D texture_data_static;
	uniform float time;
	uniform float length_loop;
	uniform float length_start_delay;
	uniform float length_ring_assembly;
	uniform float length_slice_assembly;
	in vec2 v_coord; // UV coordinate of current point.

    // Output Variables
	out vec4 cg_FragColor;

    // Procedural Float Generator [-1, 1]
    // Note: Consistently returns the same pseudo-random float for the same two input values.  
	float generate_float(float value_one, float value_two) {
	    float seed_one = 78.0;
	    float seed_two = 1349.0;
	    float magnitude = (mod(floor(value_one * seed_one + value_two * seed_two), 100.0) / 100.0) * 2.0 - 1.0;
	    return magnitude;
	}

	// Detour Point Generator
	vec4 generate_detour_position(vec4 p1, vec4 p2, float seed) {
		vec4 detour = mix(p1, p2, 0.5);
		return vec4(
            detour[0] + generate_float(4.0, seed) * 0.2,
            detour[1] + generate_float(3.0, seed) * 0.05,
            detour[2] + generate_float(5.0, seed) * 0.2,
            detour[3]
		);
	}

	// Quadratic Spline Interpolator
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
		vec4 initial_position = texture(texture_initial_position, v_coord);
		vec4 final_position = texture(texture_final_position, v_coord);
		vec4 current_position = texture(texture_position, v_coord);
		float wait = texture(texture_data_static, v_coord).r;
		float seed = texture(texture_data_static, v_coord).g;
		float ambient = texture(texture_data_static, v_coord).b;
		float temp = mod(time, length_start_delay + length_loop);
		float delay_time = max(temp - length_start_delay, 0.0);
		
        if (ambient != 1.0) {

			// Calculate Animation Factor
			float factor = 0.0;
			if (delay_time > wait) {
				factor = min((delay_time - wait) / length_slice_assembly, 1.0);
			}

			// Generate Detour Position (For gently curved particle trajectory)
			vec4 detour_position = generate_detour_position(initial_position, final_position, seed);

			// Find Current Position Along Trajectory Curve
			vec4 position = interpolate_location(initial_position, detour_position, final_position, factor);

			cg_FragColor = position;

        }
	}
`;

let frag_data = `#version 300 es
	precision mediump float;

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

	out vec4 cg_FragColor; 

	float random(vec2 p) {
    	return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453123);
	}

	void main() {
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
  
	in vec2 a_texcoord; // texcoord associated with this particle

    uniform mat4 u_proj_mat;
	uniform mat4 u_model_mat;
	uniform mat4 u_view_mat;
	uniform sampler2D u_pos; // obtain particle position from texture
	uniform float particle_size;
	uniform float particle_scaling;
	uniform float particle_size_clamp;
	uniform float camera_dist_max;
	uniform float camera_dist_factor;
	uniform vec3 position_camera;

	out vec2 v_texcoord;

	void main() {
		vec4 pos = texture(u_pos, a_texcoord); // this particle position
		gl_Position = u_proj_mat * u_view_mat * pos;

        // Scale Particles Based on Camera Distance
        if (particle_scaling == 1.0) {
        	float distance = distance(pos, vec4(position_camera[0], position_camera[1], position_camera[2], 1.0));
		    gl_PointSize = particle_size * (1.0 / (distance));
		    if (particle_size_clamp == 1.0) gl_PointSize = min(gl_PointSize, particle_size);
        } else {
        	gl_PointSize = particle_size;
        }

        v_texcoord = a_texcoord; // send texcoord to frag shader
    }
`;

let frag_particle = `#version 300 es
	precision mediump float;

    in vec2 v_texcoord; // texcoord associated with this particle
    uniform sampler2D texture_data_dynamic;

	out vec4 cg_FragColor; 

	void main() {
		float alpha = texture(texture_data_dynamic, v_texcoord).r;
		cg_FragColor = vec4(0.51, 0.8, 1.0, alpha);
	}
`;

const vertex_display = `#version 300 es
	in vec2 a_position;	
	
	out vec2 v_coord;

	void main() {	   
	   gl_PointSize = 1.0;
	   gl_Position = vec4(a_position, 0.0, 1.0); // 4 corner vertices of quad

	   v_coord = a_position * 0.5 + 0.5; // UV coords: (0, 0), (0, 1), (1, 1), (1, 0)
	}
`;

const frag_display = `#version 300 es
	precision mediump float;
	precision highp sampler2D;

	uniform sampler2D u_image;
	in vec2 v_coord;

	out vec4 cg_FragColor; 

	void main() {
	    cg_FragColor = texture(u_image, v_coord);
	}
`;


/*--- Variable Declarations ---*/

let gl, canvas;
let g_proj_mat = new Matrix4();
let g_light_dir = new Vector3([0, 0.4, 0.6]);
let g_model_mat = new Matrix4();
let g_view_mat = new Matrix4();

let vao_image; // vao for drawing image (using 2 triangles)

let g_texcoord_buffer; // texcoord associated with each particle

let prog_particle;         // Particle Renderer
let prog_display;          // FBO Renderer
let prog_position;         // Particle Position Updater
let prog_data;             // Particle Data Updater

let fbo_pos_initial;       // Particle Initial Position
let fbo_pos_final;         // Particle Final Position
let fbo_pos;               // Particle Position
let fbo_data_dynamic;      // Changing Particle Metadata
let fbo_data_static;       // Unchanging Particle Metadata

let camera_pos = [];
let random = new MersenneTwister();


/*--- Shader Execution Functions ---*/

function cg_init_shaders(gl, vshader, fshader) {
	var program = createProgram(gl, vshader, fshader); // defined in cuon-utils.js

	return program;
}

class GLProgram {
    constructor (vertex_shader, frag_shader) {
        this.attributes = {};
        this.uniforms = {};

        this.program = cg_init_shaders(gl, vertex_shader, frag_shader);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
            throw gl.getProgramInfoLog(this.program);
        
        // register attribute variables
        const attribute_count = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < attribute_count; i++) {
            const attribute_name = gl.getActiveAttrib(this.program, i).name;
            this.attributes[attribute_name] = gl.getAttribLocation(this.program, attribute_name);
        }

        // register uniform variables
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
        gl.uniform1f(this.uniforms.time, performance.now());
    }
}

function $(id) {
  return document.getElementById(id);
}

function main () {

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
    if (config.ENABLE_SLICE_INSPECTION) {

    	// Define Slice Inspection Position
        camera_pos[0] = -config.RING_RADIUS;
        camera_pos[1] = 0;
        camera_pos[2] = 1;

        // Define Slice Inspection View Matrix
    	g_proj_mat.setPerspective(30, canvas.width/canvas.height, .02, 10000);
    	// LookAt Parameters: camera pos, focus pos, up vector      
        g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], -config.RING_RADIUS, 0, 0, 0, 1, 0);

    } else {

    	// Define Standard Initial Position
        camera_pos[0] = 0;
        camera_pos[1] = 5;
        camera_pos[2] = 10;

	    // Define Standard View Matrix
        g_proj_mat.setPerspective(85, canvas.width/canvas.height, .02, 10000);
        // LookAt Parameters: camera pos, focus pos, up vector 
	    g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], 0, -0.5, 0, 0, 1, 0); // camera pos, focus pos, up vector
    }

    // Send Variables to Particle Program
	gl.uniformMatrix4fv(prog_particle.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1i(prog_particle.uniforms.u_sampler, 0);
    gl.uniform1f(prog_particle.uniforms.particle_size, config.PARTICLE_SIZE);
    gl.uniform3fv(prog_particle.uniforms.position_camera, camera_pos);
    gl.uniform1f(prog_particle.uniforms.particle_scaling, config.ENABLE_PARTICLE_SCALING ? 1 : 0);
    gl.uniform1f(prog_particle.uniforms.particle_size_clamp, config.PARTICLE_SIZE_CLAMP ? 1 : 0);

	// Generate Ring Particles
	let pa = new Array(config.TEXTURE_SIZE * config.TEXTURE_SIZE);
	let particle_index = 0;

    // Generate First Slice
	for (let particle = 0; particle < config.SLICE_PARTICLES; particle++) {
		pa[particle_index] = new Particle();
		initialize_active_particle(pa[particle_index], 0, particle);
		particle_index++;
	}

    // Generate Mirrored Slices
	for (let slice = 1; slice < (config.RING_SLICES / 2); slice++) {

		// Generate Slice
		for (let particle = 0; particle < config.SLICE_PARTICLES; particle++) {
			pa[particle_index] = new Particle();
		    initialize_active_particle(pa[particle_index], slice, particle);
		    particle_index++;
		}

		// Mirror Slice
		for (let particle = 0; particle < config.SLICE_PARTICLES; particle++) {
			let old_particle_index = particle_index - config.SLICE_PARTICLES;
			pa[particle_index] = invert_particle_over_x(pa[old_particle_index]);
		    particle_index++;
		}
	}

	// Generate Last Slice
	for (let particle = 0; particle < config.SLICE_PARTICLES; particle++) {
		pa[particle_index] = new Particle();
		initialize_active_particle(pa[particle_index], (config.RING_SLICES / 2), particle);
		particle_index++;
	}

	// Generate Ambient Particles
	for (let x = particle_index; x < pa.length; x++) {
		pa[x] = new Particle();
		initialize_ambient_particle(pa[x]);
	}

    // Create VAO Image
   	vao_image_create();

    // Setup Frame Buffer Objects
	cg_init_framebuffers(); // create fbos 
	create_fbos(pa);        // initialize fbo data
	init_buffers(prog_particle); 
	send_texture_coordinates_to_gpu(pa);

    // Define Update Function
	let update = function() {    

        // Clear Canvas
		gl.clear(gl.COLOR_BUFFER_BIT);

        // Update Camera
        if (!config.ENABLE_SLICE_INSPECTION) {

        	// Update Position
			let progress = performance.now() % (config.LENGTH_LOOP + config.LENGTH_START_DELAY) / 100000;
			camera_pos[0] = 4.25 * Math.sin(Math.PI * progress + 1 - Math.PI / 2);
			camera_pos[1] = -0.15 * (Math.sin(Math.PI * progress + 1) -1.5);
			camera_pos[2] = 4.25 * Math.sin(Math.PI * progress + 1);
			focus_pos_y = -(camera_pos[1] / 2);

			// Update View Matrix
			g_view_mat.setLookAt(camera_pos[0], camera_pos[1], camera_pos[2], 0, focus_pos_y, 0, 0, 1, 0);
			gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
			gl.uniform3fv(prog_particle.uniforms.position_camera, camera_pos);
			gl.uniform1f(prog_particle.uniforms.particle_scaling, config.ENABLE_PARTICLE_SCALING ? 1 : 0);
        }

        // Render Scene
		update_position(fbo_pos_initial, fbo_pos_final, fbo_pos, fbo_data_static);
		update_data(fbo_pos, fbo_data_dynamic, fbo_data_static);
	    draw_particle(fbo_pos, fbo_data_dynamic, pa); 

		requestAnimationFrame(update);
	};
	update();
}

function init_buffers (prog) {

    // no need to create vertex buffer because
    // we are getting that info from texture map
    // but we still need texcoord buffer because
    // it records how to map particle index to texcoord
  	g_texcoord_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, g_texcoord_buffer);
	gl.vertexAttribPointer(prog.attributes.a_texcoord, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(prog.attributes.a_texcoord);

}

function send_texture_coordinates_to_gpu (pa) {
    
    // Note: Calculations involving tiny decimals require special care
    //       because JavaScript's math is broken. In this case, operations
    //       on a decimal representing the width of a single pixel intermittently
    //       produce the wrong result due to floating point errors. To work
    //       around the issue, this block uses the arbitrary-precision decimal
    //       library decimal.js.
    // Source: https://github.com/MikeMcl/decimal.js/

    // Declare Variables
    let coords = [];
    let pixel_size = (new Decimal(1.0)).dividedBy(new Decimal(config.TEXTURE_SIZE)); // 1 / TEXTURE_SIZE
    let half_pixel_size = pixel_size.dividedBy(new Decimal(2)); // pixel_size / 2

    // Generate Texture Coordinates [0, 1] for Each Pixel
    for (let x = 0; x < config.TEXTURE_SIZE; x++) {
    	for (let y = 0; y < config.TEXTURE_SIZE; y++) {
    		let coord_x = pixel_size.times(new Decimal(x).plus(half_pixel_size)).toPrecision(5);
    		let coord_y = pixel_size.times(new Decimal(y).plus(half_pixel_size)).toPrecision(5);
		    coords.push(coord_x);
		    coords.push(coord_y);
    	}
    }

    // Send Texture Coordinates to GPU
	let texcoords = new Float32Array(coords); 
	gl.bindBuffer(gl.ARRAY_BUFFER, g_texcoord_buffer);    
	gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
}


/*--- Particle Class & Generation ---*/

function Particle () {
	this.position_initial = new Array(3);
	this.position_final = new Array(3);
	this.position = new Array(3);
	this.alpha = 0.0;
	this.wait = 0.0;
	this.brightness = 1;
	this.seed = 0;
	this.ambient = 0;
}

function initialize_active_particle (p, slice, particle) {

    // Generate Final Position
	let slice_position_final = generate_slice_position_final(slice);
	let particle_position_final = generate_particle_position_final(slice_position_final, particle, slice);
	p.position_final[0] = particle_position_final[0];
	p.position_final[1] = particle_position_final[1];
	p.position_final[2] = particle_position_final[2];

    // Generate Initial Position
	p.position_initial[0] = p.position_final[0] + ((Math.random() - 0.5) * 1.5);
	p.position_initial[1] = p.position_final[1] + ((Math.random() - 0.5) * .2);
	p.position_initial[2] = p.position_final[2] + ((Math.random() - 0.5) * 1.5);

    // Generate Position
	p.position[0] = p.position_initial[0];
	p.position[1] = p.position_initial[1];
	p.position[2] = p.position_initial[2];

    // Generate Wait Time
    let wait_window = config.LENGTH_RING_ASSEMBLY - config.LENGTH_SLICE_ASSEMBLY;
    let slice_wait = new Decimal(wait_window).dividedBy((new Decimal(config.RING_SLICES)).dividedBy(new Decimal(2)));
    let base_wait = slice_wait.times(new Decimal(slice));
    let final_wait = base_wait.plus((new Decimal(Math.random())).times(new Decimal(config.PARTICLE_WAIT_VARIATION)));
    p.wait = final_wait.toPrecision(5);

    // Generate Seed
    p.seed = Math.max(Math.random(), 0.2); // Clamped to avoid unpredictable behavior at small values.
}

function generate_slice_position_final(slice) {
	let angular_factor_x = Math.sin(2 * Math.PI * (slice / config.RING_SLICES) - Math.PI / 2);
	let angular_factor_y = Math.sin(2 * Math.PI * (slice / config.RING_SLICES));

	let slice_position_final = [];
	slice_position_final[0] = angular_factor_x * config.RING_RADIUS;
	slice_position_final[1] = 0.0;
	slice_position_final[2] = angular_factor_y * config.RING_RADIUS;
	return slice_position_final;
}

function generate_particle_position_final(base, particle, slice) {
    let angular_factor_x = Math.sin(2 * Math.PI * (slice / config.RING_SLICES) - Math.PI / 2);
	let angular_factor_y = Math.sin(2 * Math.PI * (slice / config.RING_SLICES));

	let particle_position_final = [];
	particle_position_final[0] = generate_particle_position_final_horizontal(base[0], particle, angular_factor_x);
	particle_position_final[1] = generate_particle_position_final_vertical(base[1], particle);
	particle_position_final[2] = generate_particle_position_final_horizontal(base[2], particle, angular_factor_y);
	return particle_position_final;
}

function generate_particle_position_final_horizontal (base, particle, angle_factor) {
    if (config.SLICE_WIDTH == 1) {

		// Return Single Column Width
		return base;

	} else if (config.SLICE_WIDTH == 2) {

		// Calculate Double Column Width
		let width = 0.5;
		if (particle >= config.SLICE_PARTICLES / 2) {
			width *= -1;
		}

		// Return Double Column Width
		return base + width * config.SLICE_SIZE * angle_factor;

	} else {

		// Calculate Width
		let mirrored_particle = particle % (config.SLICE_PARTICLES / 2);
		let width = 0;
		if (config.SLICE_WIDTH % 2 == 0) {

			// Calculate Even Width
			let quarter = config.SLICE_PARTICLES / 4;
			if (config.SLICE_PARTICLES % 4 == 0) quarter -= .5; 
			let distance = Math.abs(mirrored_particle - quarter);
			let clamp = Math.abs((config.SLICE_HEIGHT / 2 - 1) - quarter);
			width = Math.min(distance, clamp);

		} else {

			// Calculate Odd Width
			let quarter = config.SLICE_PARTICLES / 4;
			if (config.SLICE_PARTICLES % 4 != 0) quarter -= .5; 
			let distance = Math.abs(mirrored_particle - quarter);
			let clamp = Math.abs(((config.SLICE_HEIGHT - 1) / 2) - quarter);
			width = Math.min(distance, clamp);
		}

		// Account for Sign
		if (particle < (config.SLICE_PARTICLES / 4) || particle >= (config.SLICE_PARTICLES / 4) * 3)  {
			width = Math.abs(width) * -1;
		} else {
			width = Math.abs(width);
		}

		// Return Width
		return base + width * config.SLICE_SIZE * angle_factor;
	}
}

function generate_particle_position_final_vertical (base, particle) {
    if (config.SLICE_HEIGHT == 1) {

		// Return Single Row Height
		return 0;

	} else if (config.SLICE_HEIGHT == 2) {

		// Calculate Double Row Height
		let height = 0.5;
		if (particle >= config.SLICE_PARTICLES / 2) {
			height *= -1;
		}

		// Return Double Row Height
		return height * config.SLICE_SIZE;

	} else {

		// Calculate Height
		let mirrored_particle = particle % (config.SLICE_PARTICLES / 2);
		let height = 0;
		if (config.SLICE_HEIGHT % 2 == 0) {

			// Calculate Even Height
			let quarter = config.SLICE_PARTICLES / 4 - 0.5;
			let distance = Math.abs(mirrored_particle - quarter);
			let clamp = Math.abs((config.SLICE_HEIGHT / 2 - 1) - quarter);
			let value = Math.max(distance, clamp) - clamp;
			height = config.SLICE_HEIGHT / 2 - 1 - value + 0.5;

		} else {

			// Calculate Odd Height
			let quarter = config.SLICE_PARTICLES / 4;
			let distance = Math.abs(mirrored_particle - quarter);
			let clamp = Math.abs(((config.SLICE_HEIGHT - 1) / 2) - quarter);
			let value = Math.max(distance, clamp) - clamp;
			height = (config.SLICE_HEIGHT - 1) / 2 - value;
		}

		// Account for Sign
		if (particle >= config.SLICE_PARTICLES / 2) {
			height *= -1;
		}

		// Return Height
		return height * config.SLICE_SIZE;
	}
}

function initialize_ambient_particle (p) {

    // Generate Initial Position
	p.position_initial[0] = better_random() * config.AMBIENT_WIDTH;
	p.position_initial[1] = better_random() * config.AMBIENT_HEIGHT;
	p.position_initial[2] = better_random() * config.AMBIENT_WIDTH;

	// Generate Final Position
	p.position_final[0] = 0;
	p.position_final[1] = 0;
	p.position_final[2] = 0;

    // Generate Position
	p.position[0] = p.position_initial[0];
	p.position[1] = p.position_initial[1];
	p.position[2] = p.position_initial[2];

    // Generate Ambient Data
    p.wait = 0.0;
    p.seed = 0.0;
    p.ambient = 1;
}

function invert_particle_over_x (p) {
	let new_particle = new Particle();

	// Invert Initial Position
	new_particle.position_initial[0] = p.position_initial[0];
	new_particle.position_initial[1] = p.position_initial[1];
	new_particle.position_initial[2] = -p.position_initial[2];

	// Generate Final Position
	new_particle.position_final[0] = p.position_final[0];
	new_particle.position_final[1] = p.position_final[1];
	new_particle.position_final[2] = -p.position_final[2];

    // Generate Position
	new_particle.position[0] = p.position[0];
	new_particle.position[1] = p.position[1];
	new_particle.position[2] = -p.position[2];

    // Generate Ambient Data
    new_particle.alpha = p.alpha;
    new_particle.brightness = p.brightness;
    new_particle.wait = p.wait;
    new_particle.seed = Math.max(Math.random(), 0.2); // Clamped to avoid unpredictable behavior at small values.
    new_particle.ambient = p.ambient;

    return new_particle;
}

function better_random() {
	return random.random() * 2 - 1;
}


/*--- Frame Buffer Object Generation ---*/

function create_fbos (pa) {

	let position_initial = [];
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
    
    // add texture image to fbo
	fbo_pos_initial.read.addTexture(new Float32Array(position_initial));
	fbo_pos_final.read.addTexture(new Float32Array(position_final));
	fbo_pos.read.addTexture(new Float32Array(position));
	fbo_data_dynamic.read.addTexture(new Float32Array(data_dynamic));
	fbo_data_static.read.addTexture(new Float32Array(data_static));
}

// When attaching a texture to a framebuffer, all rendering commands will 
// write to the texture as if it was a normal color/depth or stencil buffer.
// The advantage of using textures is that the result of all rendering operations
// will be stored as a texture image that we can then easily used in shaders
function create_fbo (w, h, internalFormat, format, type, param) {

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
        single: true, // single fbo
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

// create 2 FBOs so one pixel processing can be done in-place
function create_double_fbo (w, h, internalFormat, format, type, param, depth) {
    let fbo1 = create_fbo(w, h, internalFormat, format, type, param, depth);
    let fbo2 = create_fbo(w, h, internalFormat, format, type, param, depth);

    let texel_x = 1.0 / w;
    let texel_y = 1.0 / h;

    return {
        width: w,
        height: h,
        single: false, // double fbo
        texel_x,
        texel_y,
        get read() {
            // getter for fbo1
            return fbo1;
        },
        set read(value) {
            fbo1 = value;
        },
        get write() {
            // getter for fbo2
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

function cg_init_framebuffers() {

    gl.getExtension('EXT_color_buffer_float');
    // enables float framebuffer color attachment

    fbo_pos_initial = create_double_fbo(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
    fbo_pos_final = create_double_fbo(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
    fbo_pos = create_double_fbo(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
    fbo_data_dynamic = create_double_fbo(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);
    fbo_data_static = create_double_fbo(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);

}

function update_position (position_initial, position_final, position, data_static) {
    let program = prog_position;
    program.bind_time();

    if (position_initial.single) gl.uniform1i(program.uniforms.texture_initial_position, position_initial.attach(1));
    else gl.uniform1i(program.uniforms.texture_initial_position, position_initial.read.attach(1));

    if (position_final.single) gl.uniform1i(program.uniforms.texture_final_position, position_final.attach(2));
    else gl.uniform1i(program.uniforms.texture_final_position, position_final.read.attach(2));

    if (position.single) gl.uniform1i(program.uniforms.texture_position, position.attach(3));
    else gl.uniform1i(program.uniforms.texture_position, position.read.attach(3));

    if (data_static.single) gl.uniform1i(program.uniforms.texture_data_static, data_static.attach(4));
    else gl.uniform1i(program.uniforms.texture_data_static, data_static.read.attach(4));

    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_ring_assembly, config.LENGTH_RING_ASSEMBLY);
    gl.uniform1f(program.uniforms.length_slice_assembly, config.LENGTH_SLICE_ASSEMBLY);
    gl.uniform1f(program.uniforms.camera_dist_max, config.CAMERA_DIST_MAX);
    gl.uniform1f(program.uniforms.camera_dist_factor, config.CAMERA_DIST_FACTOR);

    gl.viewport(0, 0, position.width, position.height);
 
    if (position.single) draw_vao_image(position.fbo);
    else {
        draw_vao_image(position.write.fbo);
        position.swap();
    }  
}

function update_data (position, data_dynamic, data_static) {
    let program = prog_data;
    program.bind_time();

    if (position.single) gl.uniform1i(program.uniforms.texture_position, position.attach(1));
    else gl.uniform1i(program.uniforms.texture_position, position.read.attach(1));

    if (data_dynamic.single) gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.attach(2));
    else gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.read.attach(2));

    if (data_static.single) gl.uniform1i(program.uniforms.texture_data_static, data_static.attach(3));
    else gl.uniform1i(program.uniforms.texture_data_static, data_static.read.attach(3));

    gl.uniform3fv(program.uniforms.position_camera, camera_pos);
    gl.uniform1f(program.uniforms.length_loop, config.LENGTH_LOOP);
    gl.uniform1f(program.uniforms.length_start_delay, config.LENGTH_START_DELAY);
    gl.uniform1f(program.uniforms.length_particle_fade, config.LENGTH_PARTICLE_FADE);
    gl.uniform1f(program.uniforms.length_scene_fade, config.LENGTH_SCENE_FADE);
    gl.uniform1f(program.uniforms.camera_dist_max, config.CAMERA_DIST_MAX);
    gl.uniform1f(program.uniforms.camera_dist_factor, config.CAMERA_DIST_FACTOR);
    gl.uniform1f(program.uniforms.alpha_fade, config.ENABLE_ALPHA_SCALING ? 1 : 0); 

    gl.viewport(0, 0, data_dynamic.width, data_dynamic.height);
 
    if (data_dynamic.single) draw_vao_image(data_dynamic.fbo);
    else {
        draw_vao_image(data_dynamic.write.fbo);
        data_dynamic.swap();
    }  
}

function draw_particle (position, data_dynamic, pa) {
    let program = prog_particle;
    program.bind();

    if (position.single) gl.uniform1i(program.uniforms.u_pos, position.attach(1));
    else gl.uniform1i(program.uniforms.u_pos, position.read.attach(1));
    
    if (data_dynamic.single) gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.attach(2));
    else gl.uniform1i(program.uniforms.texture_data_dynamic, data_dynamic.read.attach(2));
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	gl.viewport(0, 0, canvas.width, canvas.height);

	gl.drawArrays(gl.POINTS, 0, pa.length); // draw points
}

function draw_vao_image (fbo) {
    // bind destination fbo to gl.FRAMEBUFFER
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // start recording bindBuffer or vertexAttribPointer
  	gl.bindVertexArray(vao_image);
    
    // draw trangles using 6 indices
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null); // unbind
}

function vao_image_create () {
	// create vao for 2 triangles 
    vao_image = gl.createVertexArray();
    // start recording bindBuffer or vertexAttribPointer
  	gl.bindVertexArray(vao_image);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    // we have 4 vertices, forming a 2x2 square
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    // 0 is a reference to attribute variable 'a_position' in shader

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    // note that we have 6 indices in total (3 for each triangle, or half of square)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    // 2 means (x, y)
    
    gl.bindVertexArray(null); // stop recording
}
