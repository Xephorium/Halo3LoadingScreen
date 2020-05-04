/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.03.2020
 *
 *  This program is a heavily modified version of a GPU-based particle shader
 *  provided by Henry Kang in UMSL's Topics in Computer Graphics course.
 *
 *  We stand on the shoulders of giants.
 */ 


/*--- Shader Declarations ---*/

let vertex_particle = `#version 300 es
  
	in vec2 a_texcoord; // texcoord associated with this particle

    uniform mat4 u_proj_mat;
	uniform mat4 u_model_mat;
	uniform mat4 u_view_mat;

	uniform sampler2D u_pos; // obtain particle position from texture

	out vec2 v_texcoord;

	void main() {
		gl_PointSize = 3.0;
		
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
		vec4 cout = vec4(0.0); // by default, don't draw this particle
		float alpha = texture(u_data, v_texcoord).r; // alpha of this particle
		float wait = texture(u_data, v_texcoord).g; // wait of this particle
		
		if (wait < 0.0) cout = vec4(0.2, 0.2, 0.2, alpha);
		// wait time has expired, so draw this particle
		cg_FragColor = cout;  
	}
`;

let frag_position_initial = `#version 300 es
	precision mediump float;

    // Input Variables
	uniform sampler2D texture_initial_position;
	in vec2 v_coord;

    // Output Variables
	out vec4 cg_FragColor; 

    // Define Random Function
	float random(vec2 p) {
    	return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453123);
	}

	void main() {

        // Conditionally Generate Particle Starting Position
        vec4 initial_position = texture(texture_initial_position, v_coord);
   		if (initial_position.x == 0.0 && initial_position.y == 0.0 && initial_position.z == 0.0) {
 			initial_position.x = random(v_coord * 10.0) * 0.2 + 2.0;
 			initial_position.y = random(v_coord * 20.0) * 0.2 + 2.0;
 			initial_position.z = random(v_coord * 30.0) * 0.2;
 		}

	    cg_FragColor = initial_position;
	}
`;

let frag_position_final = `#version 300 es
	precision mediump float;

    // Input Variables
	uniform sampler2D texture_final_position;
	in vec2 v_coord;

    // Output Variables
	out vec4 cg_FragColor; 

    // Define Random Function
	float random(vec2 p) {
    	return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453123);
	}

	void main() {

        // Conditionally Generate Particle Starting Position
        vec4 final_position = texture(texture_final_position, v_coord);
		if (final_position.x == 0.0 && final_position.y == 0.0 && final_position.z == 0.0) {
			final_position.x = random(v_coord * 10.0) * 0.2 - 2.0;
			final_position.y = random(v_coord * 20.0) * 0.2 + 2.0;
			final_position.z = random(v_coord * 30.0) * 0.2;
		}

	    cg_FragColor = final_position;
	}
`;

let frag_position = `#version 300 es
	precision mediump float;

    // Input Variables
    uniform sampler2D texture_initial_position;
	uniform sampler2D texture_final_position;
	uniform sampler2D texture_position;
	uniform sampler2D texture_data;
	in vec2 v_coord;

    // Output Variables
	out vec4 cg_FragColor; 

    // Define Random Function
	float random(vec2 p) {
    	return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453123);
	}

	void main() {

        // Conditionally Generate Particle Starting Position
        vec4 position = texture(texture_position, v_coord);

	    cg_FragColor = position - vec4(0.05, 0.0, 0.0, 0.0);
	}
`;

let frag_data = `#version 300 es
	precision mediump float;

	uniform sampler2D u_data; // data texture
	in vec2 v_coord;

	out vec4 cg_FragColor; 

	float random(vec2 p) {
    	return fract(sin(dot(p.xy, vec2(12.9898,78.233))) * 43758.5453123);
	}

	void main() {
		float alpha = texture(u_data, v_coord).r; // alpha
        float wait = texture(u_data, v_coord).g; // wait
        
        wait = wait - 1.0;
        if (alpha < 0.0) {
        	alpha = 1.0;
       	    wait = random(v_coord * 100.0) * 300.0; // [0, 120]
        }
        if (wait < 0.0) { // wait time over, let's update alpha
		    alpha = alpha - 0.005;
		}
		    
        cg_FragColor = vec4(alpha, wait, 0.0, 1.0);
        // note fbo_data contains both alpha and wait
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
	RESOLUTION_SCALE: 1.0,                   // Default: 1080p
	BACKGROUND_COLOR: [1.0, 1.0, 1.0, 1.0],
    TEXTURE_SIZE: 100                        // Value squared is max particle count.
}


/*--- Variable Declarations ---*/

let gl, canvas;
let g_proj_mat = new Matrix4();
let g_light_dir = new Vector3([0, 0.4, 0.6]);
let g_model_mat = new Matrix4();
let g_view_mat = new Matrix4();

let vao_image; // vao for drawing image (using 2 triangles)

let g_texcoord_buffer; // texcoord associated with each particle
let g_normal_buffer;
let g_index_buffer;

let prog_particle;         // particle renderer
let prog_display;          // fbo renderer
let prog_position_initial; // Particle Initial Position Updater
let prog_position_final;   // Particle Final Position Updater
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
        this.program = gl.createProgram();

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

	prog_particle = new GLProgram(vertex_particle, frag_particle);
	prog_particle.bind();

    prog_display = new GLProgram(vertex_display, frag_display);
	
	prog_position_initial = new GLProgram(vertex_display, frag_position_initial);
	prog_position_final = new GLProgram(vertex_display, frag_position_final);
	prog_position = new GLProgram(vertex_display, frag_position);
    prog_data = new GLProgram(vertex_display, frag_data);

	g_proj_mat.setPerspective(30, canvas.width/canvas.height, 1, 10000);
	g_view_mat.setLookAt(0, 3, 10, 0, 2, 0, 0, 1, 0); // eyePos - focusPos - upVector    

	gl.uniformMatrix4fv(prog_particle.uniforms.u_proj_mat, false, g_proj_mat.elements);
	gl.uniformMatrix4fv(prog_particle.uniforms.u_view_mat, false, g_view_mat.elements);
	gl.uniform1i(prog_particle.uniforms.u_sampler, 0);

	// Create particles
	let pa = new Array(config.TEXTURE_SIZE * config.TEXTURE_SIZE); 

	for (let i = 0; i < pa.length; ++i) {
		pa[i] = new Particle();
		init_particle(pa[i], true);
	}

   	vao_image_create();

	cg_init_framebuffers(); // create fbos 
	create_fbos(pa);        // initialize fbo data

	init_buffers(prog_particle); 
	send_buffer_data(pa);

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

		update_position_initial(fbo_pos_initial);
	    update_position_final(fbo_pos_final);
		update_data(fbo_data);
		update_position(fbo_pos_initial, fbo_pos_final, fbo_pos, fbo_data);
        
	    draw_particle(fbo_pos_initial, fbo_pos_final, fbo_data, pa);

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

// send buffer data to gpu 
function send_buffer_data (pa) {

	let coords = [];

	for (let i = 0; i < pa.length; ++i) {	
		let y = Math.floor(i / config.TEXTURE_SIZE);
		let x = i - config.TEXTURE_SIZE * y;  
		coords.push(x/config.TEXTURE_SIZE); // [0, 1]
		coords.push(y/config.TEXTURE_SIZE); // [0, 1]
	}

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
	this.alpha = 0;
	this.wait = 0;
	this.brightness = 1;
	this.seed = 0;
}

function init_particle (p, wait) {

    // Generate Initial Position
	p.position_initial[0] = Math.random() * 0.2 + 2.0;
	p.position_initial[1] = Math.random() * 0.2 + 2.0;
	p.position_initial[2] = Math.random() * 0.2;

	// Generate Final Position
	p.position_final[0] = Math.random() * 0.2 - 2.0;
	p.position_final[1] = Math.random() * 0.2 + 2.0;
	p.position_final[2] = Math.random() * 0.2;

    // Generate Position
	p.position[0] = p.position_initial[0];
	p.position[1] = p.position_initial[1];
	p.position[2] = p.position_initial[2];

    // Generate Default Data
    p.alpha = 1;
    p.wait = Math.random() * 300;
    p.brightness = 1;
    p.seed = Math.random() * 1000;
}

function create_fbos (pa) {

	let position_initial = [];
	let position_final = [];
	let position = [];
	let data = [];

	for (let i = 0; i < pa.length; ++i) {
		position_initial.push(pa[i].position_initial[0]); // x
		position_initial.push(pa[i].position_initial[1]); // y
		position_initial.push(pa[i].position_initial[2]); // z
		position_initial.push(1);                         // w

		position_final.push(pa[i].position_initial[0]); // x
		position_final.push(pa[i].position_initial[1]); // y
		position_final.push(pa[i].position_initial[2]); // z
		position_final.push(1);                         // w

		position.push(pa[i].position[0]); // x
		position.push(pa[i].position[1]); // y
		position.push(pa[i].position[2]); // z
		position.push(1);                 // w

		data.push(pa[i].alpha);     // x
		data.push(pa[i].wait);      // y
		data.push(pa[i].bightness); // z
		data.push(pa[i].seed);      // w 
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

// render to default framebuffer
function render_null (src) {
    let program = prog_display;
    program.bind();

    if (src.single) gl.uniform1i(program.uniforms.u_image, src.attach(7));
    else gl.uniform1i(program.uniforms.u_image, src.read.attach(7));

    gl.viewport(0, 0, canvas.width, canvas.height);

    draw_vao_image(null);
}

function render_img (src, dst) {
    let program = prog_display;
    program.bind();

    if (src.single) gl.uniform1i(program.uniforms.u_image, src.attach(8));
    else gl.uniform1i(program.uniforms.u_image, src.read.attach(8));
    
    gl.viewport(0, 0, dst.width, dst.height);
 
    if (dst.single) draw_vao_image(dst.fbo);
    else {
        draw_vao_image(dst.write.fbo);
        dst.swap();
    }  
}


function update_data (data) {
    let program = prog_data;
    program.bind();

    if (data.single) gl.uniform1i(program.uniforms.u_data, data.attach(1));
    else gl.uniform1i(program.uniforms.u_data, data.read.attach(1));

    gl.viewport(0, 0, data.width, data.height);
 
    if (data.single) draw_vao_image(data.fbo);
    else {
        draw_vao_image(data.write.fbo);
        data.swap();
    }  
}

function update_position_initial (position_initial) {
    let program = prog_position_initial;
    program.bind();

    if (position_initial.single) gl.uniform1i(program.uniforms.texture_initial_position, position_initial.attach(1));
    else gl.uniform1i(program.uniforms.texture_initial_position, position_initial.read.attach(1));
    
    gl.viewport(0, 0, position_initial.width, position_initial.height);
 
    if (position_initial.single) draw_vao_image(position_initial.fbo);
    else {
        draw_vao_image(position_initial.write.fbo);
        position_initial.swap();
    }  
}

function update_position_final (position_final) {
    let program = prog_position_final;
    program.bind();

    if (position_final.single) gl.uniform1i(program.uniforms.texture_final_position, position_final.attach(1));
    else gl.uniform1i(program.uniforms.texture_final_position, position_final.read.attach(1));
    
    gl.viewport(0, 0, position_final.width, position_final.height);
 
    if (position_final.single) draw_vao_image(position_final.fbo);
    else {
        draw_vao_image(position_final.write.fbo);
        position_final.swap();
    }  
}

function update_position (position_initial, position_final, position, data) {
    let program = prog_position;
    program.bind();

    if (position_initial.single) gl.uniform1i(program.uniforms.texture_initial_position, position_initial.attach(1));
    else gl.uniform1i(program.uniforms.texture_initial_position, position_initial.read.attach(1));

    if (position_final.single) gl.uniform1i(program.uniforms.texture_final_position, position_final.attach(2));
    else gl.uniform1i(program.uniforms.texture_final_position, position_final.read.attach(2));

    if (position.single) gl.uniform1i(program.uniforms.texture_position, position.attach(3));
    else gl.uniform1i(program.uniforms.texture_position, position.read.attach(3));

    if (data.single) gl.uniform1i(program.uniforms.texture_data, data.attach(4));
    else gl.uniform1i(program.uniforms.texture_data, data.read.attach(4));
    
    gl.viewport(0, 0, position.width, position.height);
 
    if (position.single) draw_vao_image(position.fbo);
    else {
        draw_vao_image(position.write.fbo);
        position.swap();
    }  
}

function draw_particle (position_initial, position_final, data, pa) {
    let program = prog_particle;
    program.bind();

    if (position_initial.single) gl.uniform1i(program.uniforms.u_pos, position_initial.attach(1));
    else gl.uniform1i(program.uniforms.u_pos, position_initial.read.attach(1));
    
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
