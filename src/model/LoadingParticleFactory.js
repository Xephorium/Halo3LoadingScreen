/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.16.2020
 *
 *  The LoadingParticleFactory class encapsulates the logic required to generate
 *  each animated particle of the Halo 3 Loading Screen. It builds the final ring
 *  in "slices", where each slice is a cross-sectional assortment of particles
 *  that produces the desired ring shape.
 *
 *  Note: Despite my organizational preferences, this class declares methods
 *        in the order in which they're used. JavaScript is a primitive language
 *        for small brains and lacks method hoisting. The class' primary
 *        generateLoadingParticles() method is at the bottom of the file.
 */


 class LoadingParticleFactory {


     /*--- Constructor ---*/

    constructor(config) {

        // Initialize Class Fields
        this.random = new MersenneTwister();
        this.config = config;
    }


    /*--- Utility Methods ---*/

    // Generates Random Number [-1, 1]
    better_random() {
        return this.random.random() * 2 - 1;
    }

    // Generates Random Number [-1, -.25] || [.25, 1]
    min_random() {
        let reduced_range = this.better_random() * .75;
        if (reduced_range >= 0) reduced_range += .25;
        else reduced_range -= .25;
        return reduced_range;
    }

    // Returns Location Halfway Between Two Passed Points
    middle_point(pointOne, pointTwo) {
        return [
            Interpolator.linearlyInterpolateValues(pointOne[0], pointTwo[0], 0.5),
            Interpolator.linearlyInterpolateValues(pointOne[1], pointTwo[1], 0.5),
            Interpolator.linearlyInterpolateValues(pointOne[2], pointTwo[2], 0.5),
        ];
    }


    /*--- Initialization Methods ---*/

    initialize_active_particle (p, slice, particle) {
        let angular_factor_x = Math.sin(2 * Math.PI * (slice / this.config.RING_SLICES) - Math.PI / 2);
        let angular_factor_y = Math.sin(2 * Math.PI * (slice / this.config.RING_SLICES));

        // Generate Final Position
        let slice_position_final = this.generate_slice_position_final(slice);
        let particle_position_final = this.generate_particle_position_final(slice_position_final, particle, slice);
        p.position_final[0] = particle_position_final[0];
        p.position_final[1] = particle_position_final[1];
        p.position_final[2] = particle_position_final[2];

        // Generate Initial Position
        p.position_initial[0] = p.position_final[0] + this.min_random() * .006 * angular_factor_x;
        p.position_initial[1] = p.position_final[1] + this.better_random() * .0005;
        p.position_initial[2] = p.position_final[2] + this.min_random() * .006 * angular_factor_y;

        // Generate Swerve Position
        let swerve_base = this.middle_point(p.position_final, p.position_initial);
        p.position_swerve[0] = swerve_base[0] - (this.better_random() * 0.00005);
        p.position_swerve[1] = swerve_base[1] - (this.better_random() * 0.000005);
        p.position_swerve[2] = swerve_base[2] - (this.better_random() * 0.00005);

        // Generate Position
        p.position[0] = p.position_initial[0];
        p.position[1] = p.position_initial[1];
        p.position[2] = p.position_initial[2];

        // Generate Wait Time
        let wait_window = this.config.LENGTH_RING_ASSEMBLY - this.config.LENGTH_SLICE_ASSEMBLY;
        let slice_wait = new Decimal(wait_window).dividedBy((new Decimal(this.config.RING_SLICES)).dividedBy(new Decimal(2)));
        let base_wait = slice_wait.times(new Decimal(slice));
        let final_wait = base_wait.plus((new Decimal(this.better_random())).times(new Decimal(this.config.PARTICLE_WAIT_VARIATION)));
        p.wait = final_wait.toPrecision(5);

        // Generate Seed
        p.seed = Math.max(this.better_random(), 0.2); // Clamped to avoid unpredictable behavior at small values.

        // Generate Slice Angle
        p.slice_angle = 180 - ((slice / this.config.RING_SLICES) * 360);
    }

    initialize_ambient_particle (p) {

        // Generate Initial Position
        p.position_initial[0] = this.better_random() * this.config.AMBIENT_WIDTH + 0.7;
        p.position_initial[1] = this.better_random() * this.config.AMBIENT_HEIGHT;
        p.position_initial[2] = this.better_random() * (this.config.AMBIENT_WIDTH * 0.8) - 0.5;

        // Generate Final Position
        p.position_final[0] = (this.better_random() - 1.5) * this.config.AMBIENT_DRIFT;
        p.position_final[1] = this.better_random() * this.config.AMBIENT_DRIFT;
        p.position_final[2] = this.better_random() * this.config.AMBIENT_DRIFT;

        // Generate Swerve Position
        p.position_swerve[0] = 0.0;
        p.position_swerve[1] = 0.0;
        p.position_swerve[2] = 0.0;

        // Generate Position
        p.position[0] = p.position_initial[0];
        p.position[1] = p.position_initial[1];
        p.position[2] = p.position_initial[2];

        // Generate Ambient Data
        p.wait = 0.0;
        p.seed = 0.0;
        p.ambient = 1;
    }


    /*--- Position Calculation Methods ---*/

    generate_slice_position_final(slice) {
        let angular_factor_x = Math.sin(2 * Math.PI * (slice / this.config.RING_SLICES) - Math.PI / 2);
        let angular_factor_y = Math.sin(2 * Math.PI * (slice / this.config.RING_SLICES));

        let slice_position_final = [];
        slice_position_final[0] = angular_factor_x * this.config.RING_RADIUS;
        slice_position_final[1] = 0.0;
        slice_position_final[2] = angular_factor_y * this.config.RING_RADIUS;
        return slice_position_final;
    }

    generate_particle_position_final(base, particle, slice) {
        let angular_factor_x = Math.sin(2 * Math.PI * (slice / this.config.RING_SLICES) - Math.PI / 2);
        let angular_factor_y = Math.sin(2 * Math.PI * (slice / this.config.RING_SLICES));
        let offset = this.generate_particle_position_final_offset(particle);

        let particle_position_final = [];
        particle_position_final[0] = base[0] + (this.config.SLICE_SIZE * offset[0] * angular_factor_x);
        particle_position_final[1] = base[1] + (this.config.SLICE_SIZE * offset[1]);
        particle_position_final[2] = base[2] + (this.config.SLICE_SIZE * offset[0] * angular_factor_y);
        return particle_position_final;
    }

    generate_particle_position_final_offset(p) {

        /* /////////////////////////////
         * //// Slice Shape Diagram ////
         * /////////////////////////////
         * 
         * Total Particles: 66
         * Half Particles: 33
         * 
         *             7 8 9
         *             6 . 0
         *         3 4 5 . 1
         *         2 . . . 2
         *     9 0 1 . . . 3
         *     8 . . . . . 4
         *     7 . . . . . 5
         *     6 . . . . . 6
         *     5 . . . . . 7
         *     4 . . . . . 8
         *     3 . . . . . 9
         *     2 . . . . . 0
         *     1 . . . . . 1
         *     0 . . . . . 2
         *     ------x------
         */

        // Note: Table contains the offset from slice center (x) of
        //       each particle to produce the slice shape above. Half
        //       offset is subtracted from vertical positions last.
        let particle = p % (this.config.SLICE_PARTICLES / 2);
        let sign = p >= (this.config.SLICE_PARTICLES / 2) ? -1 : 1;
        let offset = [0.0, 0.0];
        switch(particle) {
            case  0: offset = [-3,  1]; break;
            case  1: offset = [-3,  2]; break;
            case  2: offset = [-3,  3]; break;
            case  3: offset = [-3,  4]; break;
            case  4: offset = [-3,  5]; break;
            case  5: offset = [-3,  6]; break;
            case  6: offset = [-3,  7]; break;
            case  7: offset = [-3,  8]; break;
            case  8: offset = [-3,  9]; break;
            case  9: offset = [-3, 10]; break;
            case 10: offset = [-2, 10]; break;
            case 11: offset = [-1, 10]; break;
            case 12: offset = [-1, 11]; break;
            case 13: offset = [-1, 12]; break;
            case 14: offset = [ 0, 12]; break;
            case 15: offset = [ 1, 12]; break;
            case 16: offset = [ 1, 13]; break;
            case 17: offset = [ 1, 14]; break;
            case 18: offset = [ 2, 14]; break;
            case 19: offset = [ 3, 14]; break;
            case 20: offset = [ 3, 13]; break;
            case 21: offset = [ 3, 12]; break;
            case 22: offset = [ 3, 11]; break;
            case 23: offset = [ 3, 10]; break;
            case 24: offset = [ 3,  9]; break;
            case 25: offset = [ 3,  8]; break;
            case 26: offset = [ 3,  7]; break;
            case 27: offset = [ 3,  6]; break;
            case 28: offset = [ 3,  5]; break;
            case 29: offset = [ 3,  4]; break;
            case 30: offset = [ 3,  3]; break;
            case 31: offset = [ 3,  2]; break;
            case 32: offset = [ 3,  1]; break;
            default: break;
        }

        return [-offset[0], (offset[1] - 0.5) * sign];
    }


    /*--- Translation Methods ---*/

    invert_particle_over_x (p) {
        let new_particle = new LoadingParticle();

        // Invert Initial Position
        new_particle.position_initial[0] = p.position_initial[0];
        new_particle.position_initial[1] = p.position_initial[1];
        new_particle.position_initial[2] = -p.position_initial[2];

        // Invert Swerve Position
        new_particle.position_swerve[0] = p.position_swerve[0];
        new_particle.position_swerve[1] = p.position_swerve[1];
        new_particle.position_swerve[2] = -p.position_swerve[2];

        // Invert Final Position
        new_particle.position_final[0] = p.position_final[0];
        new_particle.position_final[1] = p.position_final[1];
        new_particle.position_final[2] = -p.position_final[2];

        // Invert Position
        new_particle.position[0] = p.position[0];
        new_particle.position[1] = p.position[1];
        new_particle.position[2] = -p.position[2];

        // Invert Ambient Data
        new_particle.alpha = p.alpha;
        new_particle.brightness = p.brightness;
        new_particle.wait = p.wait;
        new_particle.seed = Math.max(this.better_random(), 0.2); // Clamped to avoid unpredictable behavior at small values.
        new_particle.ambient = p.ambient;
        new_particle.slice_angle = -p.slice_angle;

        return new_particle;
    }


    /*--- "Public" Method ---*/

    generateLoadingParticles() {

        // Create Loading Particle Array
        let array = new Array(this.config.TEXTURE_SIZE * this.config.TEXTURE_SIZE);
        let particle_index = 0;

        // Generate First Slice
        for (let particle = 0; particle < this.config.SLICE_PARTICLES; particle++) {
            array[particle_index] = new LoadingParticle();
            this.initialize_active_particle(array[particle_index], 0, particle);
            particle_index++;
        }

        // Generate Mirrored Slices
        for (let slice = 1; slice < (this.config.RING_SLICES / 2); slice++) {

            // Generate Slice
            for (let particle = 0; particle < this.config.SLICE_PARTICLES; particle++) {
                array[particle_index] = new LoadingParticle();
                this.initialize_active_particle(array[particle_index], slice, particle);
                particle_index++;
            }

            // Mirror Slice
            for (let particle = 0; particle < this.config.SLICE_PARTICLES; particle++) {
                let old_particle_index = particle_index - this.config.SLICE_PARTICLES;
                array[particle_index] = this.invert_particle_over_x(array[old_particle_index]);
                particle_index++;
            }
        }

        // Generate Last Slice
        for (let particle = 0; particle < this.config.SLICE_PARTICLES; particle++) {
            array[particle_index] = new LoadingParticle();
            this.initialize_active_particle(array[particle_index], (this.config.RING_SLICES / 2), particle);
            particle_index++;
        }

        // Generate Ambient Particles
        for (let x = particle_index; x < array.length; x++) {
            array[x] = new LoadingParticle();
            this.initialize_ambient_particle(array[x]);
        }

        return array;
    }
 }