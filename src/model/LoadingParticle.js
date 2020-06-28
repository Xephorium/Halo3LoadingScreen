/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  05.16.2020
 *
 *  The LoadingParticle class represents a single animated particle of the
 *  Halo 3 Loading Screen. This file encapsulates the fields of each
 *  particle.
 */


 class LoadingParticle {

          
    /*--- Constructor ---*/

    constructor() {

        // Initialize Data Fields
        this.position_initial = new Array(3);
        this.position_swerve = new Array(3);
        this.position_final = new Array(3);
        this.position = new Array(3);
        this.alpha = 0.0;
        this.wait = 0.0;
        this.brightness = 1;
        this.seed = 0;
        this.ambient = 0;
        this.damaged = 0;
        this.slice_angle = 0;
    }
 }