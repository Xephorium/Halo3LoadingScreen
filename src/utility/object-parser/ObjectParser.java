import java.io.*;
import java.text.*;
import java.util.*;

/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  06.23.2020
 *
 *  The ObjectParser is a simple utility java class that parses an .obj file containing
 *  a faceless shape. After processing, it returns a list of edges as sets of two vertices.
 *  Since this tool was built for wireframe rendering in WebGL, all normal/UV data is
 *  discarded and each edge is represented by a distinct set of vertices.
 *
 *  Source Object File Format:
 *    ...
 *    v 1.0 2.0 3.0    // Vertex 1
 *    v 4.0 5.0 6.0    // Vertex 2
 *    v 7.0 8.0 9.0    // Vertex 3
 *    ...
 *    l 1 2            // Edge 1
 *    l 2 3            // Edge 2
 *    l 3 1            // Edge 3
 *
 *  Final Edge List Format:
 *    1.0, 2.0, 3.0,  4.0, 5.0, 6.0,  // Edge 1
 *    4.0, 5.0, 6.0,  7.0, 8.0, 9.0,  // Edge 2
 *    7.0, 8.0, 9.0,  1.0, 2.0, 3.0,  // Edge 3
 */


public class ObjectParser {

    public static void main(String[] args) {


        /*--- Variable Declarations ---*/

        // Constants
        String FILE_PATH = "C:\\Users\\Xephorium\\Home\\Projects\\3D Animation\\Blender Projects\\Halo - Loading Screen\\Background Grid 2.obj";

        // Variables
        ArrayList<String> fileLines = new ArrayList<>();
        ArrayList<Vertex> vertexList = new ArrayList<>();
        ArrayList<String> output = new ArrayList<>();


        /*--- Read Object File ---*/

        try {
            File file = new File(FILE_PATH);
            Scanner scanner = new Scanner(file);
            while (scanner.hasNextLine()) {
                String line = scanner.nextLine();
                fileLines.add(line);
            }
            scanner.close();
        } catch (Exception e) {
            System.out.println("Error Reading Input.");
            e.printStackTrace();
        }


        /*--- Parse Vertices ---*/

        for (String line : fileLines) {
            if (line.charAt(0) == 'v') {
                vertexList.add(new Vertex(line.substring(2, line.length())));
            }
        }


        /*--- Build Output List ---*/

        for (String line : fileLines) {
            if (line.charAt(0) == 'l') {

                // Parse Face Data
                String edgeData = line.substring(2, line.length());
                String[] edgeVertices = edgeData.split(" ");
                int v1 = Integer.valueOf(edgeVertices[0]);
                int v2 = Integer.valueOf(edgeVertices[1]);

                // Add Output Line
                output.add(vertexList.get(v1 - 1) + " " + vertexList.get(v2 - 1));
            }
        }


        /*--- Write Output to File ---*/

        try {
            FileWriter fileWriter = new FileWriter("output.txt");
            fileWriter.write("Vertex List: \n");
            for (String line : output) {
                fileWriter.write(line + "\n");
            }
            fileWriter.write("Total Vertices: " + output.size() * 2);
            fileWriter.close();
            System.out.println("Conversion Complete.");
        } catch (IOException e) {
            System.out.println("Error Writing Output.");
            e.printStackTrace();
        }
    }
}