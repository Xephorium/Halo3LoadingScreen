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
        this.xValues = [];
        this.yValues = [];
        this.matrix = [];

        // Parse Point Values
        for (let x = 0; x < points.length; x++) {
            this.xValues[x] = points[x][0];
            this.yValues[x] = points[x][1];
        }
    }


    /*--- Calculation Methods ---*/

    populateFirstMatrixRow(values) {
        this.matrix[0] = [];
        for (let index = 0; index < values.length; index++) {
            this.matrix[0][index] = values[index];
        }
    }

    linearlyInterpolateValues(valueOne, valueTwo, factor) {
        let multiplicationOne = (new Decimal(valueOne)).times(factor);
        let multiplicationTwo = (new Decimal(valueTwo)).times(new Decimal(1.0 - factor));
        return multiplicationOne.plus(multiplicationTwo).toPrecision(10);
    }
 }