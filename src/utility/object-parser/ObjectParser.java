import java.io.*;
import java.text.*;
import java.util.*;

/*  Halo 3 Loading Animation
 *  Christopher Cruzen
 *  06.23.2020
 *
 *  The ObjectParser is a simple utility java class that parses a .obj file, returning
 *  a list of faces as sets of three vertices. Since this tool was built for wireframe
 *  rendering, all normal/UV data is discarded and each triangle contains a distinct
 *  set of vertices.  
 *
 *  Source Object File Format:
 *    ...
 *    v 1.0 2.0 3.0    // Vertex 1
 *    v 4.0 5.0 6.0    // Vertex 2
 *    v 7.0 8.0 9.0    // Vertex 3
 *    ...
 *    f 1 2 3          // Triangle 1
 *    f 3 1 2          // Triangle 2
 *    f 2 3 1          // Triangle 3
 *
 *  Final Verex List Format:
 *    1.0, 2.0, 3.0,   4.0, 5.0, 6.0,   7.0, 8.0, 9.0,  // Triangle 1
 *    7.0, 8.0, 9.0,   1.0, 2.0, 3.0,   4.0, 5.0, 6.0,  // Triangle 2
 *    4.0, 5.0, 6.0,   7.0, 8.0, 9.0,   1.0, 2.0, 3.0   // Triangle 3
 */


public class ObjectParser {

    public static void main(String[] args) {


        /*--- Variable Declarations ---*/

        // Constants
        String FILE_PATH = "C:\\Users\\Xephorium\\Home\\Projects\\3D Animation\\Blender Projects\\Halo - Loading Screen\\Orientation Test Arrow.obj";

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
            System.out.println("Error Reading File");
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
            if (line.charAt(0) == 'f') {

                // Parse Face Data
                String faceData = line.substring(2, line.length());
                String[] faceVertices = faceData.split(" ");
                int v1 = Integer.valueOf(faceVertices[0]);
                int v2 = Integer.valueOf(faceVertices[1]);
                int v3 = Integer.valueOf(faceVertices[2]);

                // Add Output Line
                output.add(vertexList.get(v1 - 1) + "   " + vertexList.get(v2 - 1) + "   " + vertexList.get(v2 - 1));
            }
        }


        /*--- Print Output ---*/

        System.out.println("Vertex List: ");
        for (String line : output) {
            System.out.println(line);
        }
        System.out.println("Triangles: " + output.size());
    }
}