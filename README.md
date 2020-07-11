# Halo 3 Loading Screen
A 4K remaster of the Halo 3 loading screen built in WebGL.

![Screenshot Preview](res/Readme%20Screenshot.png)
## 
[Live Site](https://xephorium.github.io/Halo3LoadingScreen/)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
[YouTube Loop](https://youtu.be/isHpphVyQAg)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
[Wallpaper Engine](https://steamcommunity.com/sharedfiles/filedetails/?id=2160276556)

<br/>

## Render Options

Since this animation runs in real time, it supports a number of neat rendering options! The following flags can be appended to the URL to scale resolution, adjust speed, or disable individual draw calls. For example: `xephorium.github.io/Halo3LoadingScreen?2k&halfspeed&nologo`

| Render Flag | Effect |
| :---: | :--- |
| sd | 720p Resolution |
| (no flag) | 1080p Resolution |
| 2k | 1440p Resolution |
| 4k | 4K Resolution |
| ultrawide | 21:9 Aspect Ratio |
| halfspeed | Slows Animation to 1/2 Speed |
| quarterspeed | Slows Animation to 1/4 Speed |
| nologo | Disables Logo |
| nogrid | Disables Background Grid |
| nolines | Disables Guide Lines |
| noblocks | Disables Blocks |
| noparticles | Disables Particles |
| novingette | Disables Vingette Effect |

<br/>

## UltraHD Improvements

This remaster takes some creative license. After much tinkering, I found that the flurries of the original animation could become overwhelming in proper HD. So by default, particle size is slightly lowered. The background is also gently brightened to improve visual cohesion. That said, both of these artistic choices can be disabled using the following flags if you prefer the classic experience. For example: `xephorium.github.io/Halo3LoadingScreen?classicbackground&classicparticles`

| Render Flag | Effect |
| :---: | :--- |
| classicbackground | Classic Black Background |
| classicparticles | Classic Particle Scale |

<br/>

## Variants

Finally, in the spirit of Adrien Perez's legendary easter egg within the original H3 loading screen ([happy birthday, Lauren!](https://teambeyond.net/halo-3-loading-screen-easter-egg-discovered/)), this loop has a few fun variants. Each can be accessed with the following flags.

| Variants |
| :---: |
| installation08 |
| virgil |
| destiny |
| vintage |

<br/>

## Credits & Resources
- This program was built atop a simple particle shader program provided by [Henry Kang](http://www.cs.umsl.edu/~kang/) in [UMSL](http://www.umsl.edu/)'s Topics in Computer Graphics course. He's a brilliant instructor and kind soul.
- A great [interactive demo](https://ibiblio.org/e-notes/Splines/bezier.html) of DeCasteljau's bezier spline algorithm. (Adapted for this project's camera pathing.)

<br/><br/>
Were you blinded by its majesty?
