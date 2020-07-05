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
        this.zValues = [];
        this.matrix = [];

        // Parse Point Values
        for (let x = 0; x < points.length; x++) {
            this.xValues[x] = points[x][0];
            this.yValues[x] = points[x][1];
            this.zValues[x] = points[x][2];
        }
    }


    /*--- "Public" Cubic Interpolation Method ---*/

    
    getInterpolatedInteger(factor) {
        return this.calculateInterpolatedValue(this.xValues, factor);
    }
    
    getInterpolatedPoint(factor) {
        return [
            this.calculateInterpolatedValue(this.xValues, factor),
            this.calculateInterpolatedValue(this.yValues, factor),
            this.calculateInterpolatedValue(this.zValues, factor)
        ];
    }


    /*--- "Private" Calculation Methods ---*/

    calculateInterpolatedValue(values, factor) {
        this.populateFirstMatrixRow(values);

        // Perform Recursive Linear Interpolation of Coordinate Values
        for (let j = 1; j < values.length; j++) {
            this.matrix[j] = [];
            for (let i = 0; i < values.length - j; i++) {
                this.matrix[j][i] = Interpolator.linearlyInterpolateValues(this.matrix[j - 1][i + 1], this.matrix[j - 1][i], factor);
            }
        }

        return(this.matrix[values.length - 1][0]);
    }

    populateFirstMatrixRow(values) {
        this.matrix[0] = [];
        for (let index = 0; index < values.length; index++) {
            this.matrix[0][index] = values[index];
        }
    }

    static linearlyInterpolateValues(valueOne, valueTwo, factor) {
        let multiplicationOne = (new Decimal(valueOne)).times(factor);
        let multiplicationTwo = (new Decimal(valueTwo)).times(new Decimal(1.0 - factor));
        return multiplicationOne.plus(multiplicationTwo).toPrecision(10);
    }
 }