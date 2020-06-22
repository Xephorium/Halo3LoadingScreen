
/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.26.2020
 *
 *  A simple utility class that encapsulates the logic of loading an
 *  image into the project.
 */


class ImageLoader {


    /*--- "Public" Load Image Method ---*/

    static loadImage(gl, textures, url, index) {

        // Declare Local Variables
        let image = new Image();
        image.crossOrigin = "";
        image.src = url; 

        // Create a texture object
        let i = index;
        textures[i] = gl.createTexture(); 

        image.onload = function() { 

            // Configure WebGL Texture State
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, textures[i]);

            // Handle Arbitrary Image Size
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            // Add Loaded Image to WebGL Texture List
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        }
    }
}