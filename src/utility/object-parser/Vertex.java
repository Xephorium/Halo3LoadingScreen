import java.io.*;
import java.text.*;
import java.util.*;

/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  06.23.2020
 *
 *  The Vertex class represents a single vertex with three coordinate values on
 *  an x/y/z plane.
 */


public class Vertex {


    /*--- Variable Declarations ---*/

    double xCoord;
    double yCoord;
    double zCoord;


    /*--- Constructor ---*/

    public Vertex(String coords) {

        // Parse Coordinates
        String[] coordinates = coords.split(" ");
        xCoord = Double.parseDouble(coordinates[0]);
        yCoord = Double.parseDouble(coordinates[1]);
        zCoord = Double.parseDouble(coordinates[2]);
    }


    /*--- Print Method ---*/

    @Override
    public String toString() {
        return xCoord + ", " + yCoord + ", " + zCoord + ",";
    }
}