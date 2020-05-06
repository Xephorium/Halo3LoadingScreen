/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.03.2020
 *
 *  This program is a heavily modified version of a GPU-based particle shader
 *  provided by Dr. Henry Kang in UMSL's Topics in Computer Graphics course.
 *
 *  We stand on the shoulders of giants.
 */ 


/*--- Shader Declarations ---*/

let frag_position = `#version 300 es
	precision mediump float;

    // Input Variables
    uniform sampler2D texture_initial_position;
	uniform sampler2D texture_final_position;
	uniform sampler2D texture_position;
	uniform sampler2D texture_data;
	uniform float time;
	uniform float time_loop;
	uniform float time_delay;
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
            detour[0],
            detour[1],  //+ generate_float(3.0, seed) * 1.0,
            detour[2],
            detour[3]
		);
	}

	// Quadratic Spline Interpolator
	// Note: Returns a position in 3D space representing a particle's location on
	//       a smooth bezier curve between three points. 
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
		float wait = texture(texture_data, v_coord).g;
		float seed = texture(texture_data, v_coord).a;
		float factor = mod(max(time - wait, 0.0), time_loop) / time_loop;

		// Generate Detour Position (For gently curved particle trajectory)
		vec4 detour_position = generate_detour_position(initial_position, final_position, seed);

		// Find Current Position Along Trajectory Curve
		vec4 position = interpolate_location(initial_position, detour_position, final_position, factor);

        cg_FragColor = position;
	}
`;

let frag_data = `#version 300 es
	precision mediump float;

	uniform sampler2D texture_data;
	uniform float time;
	uniform float time_loop;
	uniform float time_delay;
	in vec2 v_coord;

	out vec4 cg_FragColor; 

	float random(vec2 p) {
    	return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453123);
	}

	void main() {
		float alpha = texture(texture_data, v_coord).r;
        float wait = texture(texture_data, v_coord).g;
        float seed = texture(texture_data, v_coord).a;
		float factor = mod(max(time - wait, 0.0), time_loop) / time_loop;

		alpha = 1.0;//factor;
		    
        cg_FragColor = vec4(alpha, wait, 0.0, seed);
	}	
`;

let vertex_particle = `#version 300 es
  
	in vec2 a_texcoord; // texcoord associated with this particle

    uniform mat4 u_proj_mat;
	uniform mat4 u_model_mat;
	uniform mat4 u_view_mat;

	uniform sampler2D u_pos; // obtain particle position from texture

	out vec2 v_texcoord;

	void main() {
		gl_PointSize = 10.0;
		
		vec4 pos = texture(u_pos, a_texcoord); // this particle position
		gl_Position = u_proj_mat * u_view_mat * pos;

        v_texcoord = a_texcoord; // send texcoord to frag shader
    }
`;

let frag_particle = `#version 300 es
	precision mediump float;

    in vec2 v_texcoord; // texcoord associated with this particle
    
    uniform sampler2D u_data; // contains particle info

	out vec4 cg_FragColor; 

	void main() {
		float alpha = texture(u_data, v_texcoord).r;
		cg_FragColor = vec4(0.9, 0.9, 1.0, alpha);  
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


/*--- Program Configuration ---*/

let config = {
	GLOBAL_DELAY: 1000,
	LOOP_TIME:8000,
	RESOLUTION_SCALE: 1.0,                    // Default: 1080p
	BACKGROUND_COLOR: [0.1, 0.125, 0.2, 1.0],
    RING_SLICES: 100,                         // Final = 2096
    RING_RADIUS: 3,
    TEXTURE_SIZE: 12                          // Value squared is max particle count.
}


/*--- Variable Declarations ---*/

let start = new Date();
let time = 0.0;

let gl, canvas;
let g_proj_mat = new Matrix4();
let g_light_dir = new Vector3([0, 0.4, 0.6]);
let g_model_mat = new Matrix4();
let g_view_mat = new Matrix4();

let vao_image; // vao for drawing image (using 2 triangles)

let g_texcoord_buffer; // texcoord associated with each particle
let g_normal_buffer;
let g_index_buffer;

let prog_particle;         // Particle Renderer
let prog_display;          // FBO Renderer
let prog_position;         // Particle Position Updater
let prog_data;             // Particle Data Updater

let fbo_pos_initial;       // Particle Initial Position
let fbo_pos_final;         // Particle Final Position
let fbo_pos;               // Particle Position
let fbo_data;              // Particle Metadata


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
    	var location_time = gl.getUniformLocation(this.program, "time");
    	gl.useProgram(this.program);
        gl.uniform1f(location_time, time);
    }
}

function $(id) {
  return document.getElementById(id);
}

function main () {
	// Retrieve <canvas> element
	canvas = document.getElementById('canvas');

	// Get the rendering context for WebGL
	gl = canvas.getContext('webgl2');

    // Set Render Resolution
	canvas.width  = 1920 * config.RESOLUTION_SCALE;
    canvas.height = 1080 * config.RESOLUTION_SCALE;

	prog_position = new GLProgram(vertex_display, frag_position);
    prog_data = new GLProgram(vertex_display, frag_data);

    prog_particle = new GLProgram(vertex_particle, frag_particle);
	prog_particle.bind();

	g_proj_mat.setPerspective(30, canvas.width/canvas.height, 1, 10000);
	g_view_mat.setLookAt(0, 5, 10, 0, 0, 0, 0, 1, 0); // eyePos - focusPos - upVector    

	gl.uniformMatrix4fv(prog_particle.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1i(prog_particle.uniforms.u_sampler, 0);

	// Create Ring Particles
	let pa = new Array(config.TEXTURE_SIZE * config.TEXTURE_SIZE);
	let particle_index = 0; 
	for (let x = 0; x < config.RING_SLICES; x++) {
		pa[x] = new Particle();
		initialize_active_particle(pa[x], x);
		particle_index = particle_index + 1;
	}

	// Create Disabled Particles
	for (let x = particle_index; x < pa.length; x++) {
		pa[x] = new Particle();
		initialize_disabled_particle(pa[x]);
	}

    // Log Particle Initialization
// 	for (let x = 0; x < pa.length; x++) {
// 		if (!(pa[x].position_final[0] == 0.0 && pa[x].position_final[1] == 0.0 && pa[x].position_final[2] == 0.0)) {
// 			console.log("Enabled particle");
// 		} else {
// 			console.log("Disabled particle");
// 		}
// 	}

   	vao_image_create();

	cg_init_framebuffers(); // create fbos 
	create_fbos(pa);        // initialize fbo data

	init_buffers(prog_particle); 
	send_texture_coordinates_to_gpu(pa);

    gl.clearColor(
        config.BACKGROUND_COLOR[0],
        config.BACKGROUND_COLOR[1],
        config.BACKGROUND_COLOR[2],
        config.BACKGROUND_COLOR[3]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	gl.clear(gl.COLOR_BUFFER_BIT);

	let update = function() {    

		gl.clear(gl.COLOR_BUFFER_BIT);

		update_position(fbo_pos_initial, fbo_pos_final, fbo_pos, fbo_data);
		update_data(fbo_data);
        
	    draw_particle(fbo_pos, fbo_data, pa); 

		requestAnimationFrame(update);

		time = new Date() - start;
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

            // Texture Coordinate Logging
		    //console.log(coord_x, coord_y)
    	}
    }

    // Send Texture Coordinates to GPU
	let texcoords = new Float32Array(coords); 
	gl.bindBuffer(gl.ARRAY_BUFFER, g_texcoord_buffer);    
	gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
}

//////////////////////////////////////////////////////////////////////
// Particle constructor
function Particle () {
	this.position_initial = new Array(3);
	this.position_final = new Array(3);
	this.position = new Array(3);
	this.alpha = 0.0;
	this.wait = 0.0;
	this.brightness = 1;
	this.seed = 0;
}

function initialize_active_particle (p, slice) {

    // Generate Initial Position
	p.position_initial[0] = 0.0; //Math.random() * 0.5 + 2.0;
	p.position_initial[1] = 0.0; //Math.random() * 4.0 - 2.0;
	p.position_initial[2] = 0.0; //Math.random() * 0.5;

	// Generate Final Position
	let position_x = Math.sin(2 * Math.PI * (slice / config.RING_SLICES) - Math.PI / 2) * config.RING_RADIUS; // Math.random() * 0.05 - 2.0;
	let position_z = Math.sin(2 * Math.PI * (slice / config.RING_SLICES)) * config.RING_RADIUS; //Math.random() * 0.05;
	p.position_final[0] = position_x;
	p.position_final[1] = 0.0;
	p.position_final[2] = position_z;

    // Generate Position
	p.position[0] = p.position_initial[0];
	p.position[1] = p.position_initial[1];
	p.position[2] = p.position_initial[2];

    // Generate Default Data
    p.wait = 0.0;//(slice / config.RING_SLICES) * config.LOOP_TIME;
    p.seed = Math.max(Math.random(), 0.2); // Clamped to avoid unpredictable behavior at small values.
}

function initialize_disabled_particle (p) {

    // Generate Initial Position
	p.position_initial[0] = 0.0;
	p.position_initial[1] = 0.0;
	p.position_initial[2] = 0.0;

	// Generate Final Position
	p.position_final[0] = 0.0;
	p.position_final[1] = 0.0;
	p.position_final[2] = 0.0;

    // Generate Position
	p.position[0] = 0.0;
	p.position[1] = 0.0;
	p.position[2] = 0.0;

    // Generate Default Data
    p.wait = 0.0;
    p.seed = 0.0;
}

function create_fbos (pa) {

	let position_initial = [];
	let position_final = [];
	let position = [];
	let data = [];

	for (let i = 0; i < pa.length; ++i) {

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

        // Particle Data
		data.push(pa[i].alpha);
		data.push(pa[i].wait);
		data.push(pa[i].bightness);
		data.push(pa[i].seed);
	}
    
    // add texture image to fbo
	fbo_pos_initial.read.addTexture(new Float32Array(position_initial));
	fbo_pos_final.read.addTexture(new Float32Array(position_final));
	fbo_pos.read.addTexture(new Float32Array(position));
	fbo_data.read.addTexture(new Float32Array(data));
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
    fbo_data = create_double_fbo(config.TEXTURE_SIZE, config.TEXTURE_SIZE, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST);

}

function update_position (position_initial, position_final, position, data) {
    let program = prog_position;
    program.bind_time();

    if (position_initial.single) gl.uniform1i(program.uniforms.texture_initial_position, position_initial.attach(1));
    else gl.uniform1i(program.uniforms.texture_initial_position, position_initial.read.attach(1));

    if (position_final.single) gl.uniform1i(program.uniforms.texture_final_position, position_final.attach(2));
    else gl.uniform1i(program.uniforms.texture_final_position, position_final.read.attach(2));

    if (position.single) gl.uniform1i(program.uniforms.texture_position, position.attach(3));
    else gl.uniform1i(program.uniforms.texture_position, position.read.attach(3));

    if (data.single) gl.uniform1i(program.uniforms.texture_data, data.attach(4));
    else gl.uniform1i(program.uniforms.texture_data, data.read.attach(4));

    gl.uniform1f(program.uniforms.time_loop, config.LOOP_TIME);
    
    gl.uniform1f(program.uniforms.time_delay, config.GLOBAL_DELAY);

    gl.viewport(0, 0, position.width, position.height);
 
    if (position.single) draw_vao_image(position.fbo);
    else {
        draw_vao_image(position.write.fbo);
        position.swap();
    }  
}

function update_data (data) {
    let program = prog_data;
    program.bind_time();

    if (data.single) gl.uniform1i(program.uniforms.texture_data, data.attach(1));
    else gl.uniform1i(program.uniforms.texture_data, data.read.attach(1));

    gl.uniform1f(program.uniforms.time_loop, config.LOOP_TIME);
    
    gl.uniform1f(program.uniforms.time_delay, config.GLOBAL_DELAY);

    gl.viewport(0, 0, data.width, data.height);
 
    if (data.single) draw_vao_image(data.fbo);
    else {
        draw_vao_image(data.write.fbo);
        data.swap();
    }  
}

function draw_particle (position, data, pa) {
    let program = prog_particle;
    program.bind();

    if (position.single) gl.uniform1i(program.uniforms.u_pos, position.attach(1));
    else gl.uniform1i(program.uniforms.u_pos, position.read.attach(1));
    
    if (data.single) gl.uniform1i(program.uniforms.u_data, data.attach(2));
    else gl.uniform1i(program.uniforms.u_data, data.read.attach(2));
	
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
