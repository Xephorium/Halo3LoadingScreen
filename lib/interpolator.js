/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.14.2020
 *
 *  A JavaScript implementation of De Castleljau's Algorithm for
 *  cubic interpolation between an arbitrary number of points.
 */


 class Interpolator {

    
    /*--- Constructor ---*/

    constructor(points) {

        // Initialize Fields
        this.values = points.length;
        this.xValues = [];
        this.yValues = [];
        this.matrix = [];

        // Parse Point Values
        for (let x = 0; x < points.length; x++) {
            this.xValues[x] = points[x][0];
            this.yValues[x] = points[x][1];
        }
    }
 }