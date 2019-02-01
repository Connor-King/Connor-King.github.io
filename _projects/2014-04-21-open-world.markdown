---
layout: project
title:  "Open World in DirectX 11"
date:   2018-11-25 16:54:46
author: Connor King
categories:
- project
img: openworld.png
thumb: thumb02.jpg
carousel:
- openworld01.png
- openworld02.png
- openworld03.png
- openworld04.png
- openworld05.png
tagged: C++, DirectX 11, Open World, Perlin Noise, Terrain Generation, Quad Tree, Raycasting
client: None
website: None
abstract: Perlin noise generation in DirectX 11
---
#### Open World in DirectX 11
The aim of this project was to learn how to create open worlds within DirectX 11. I decided to attempt a generation system similar to Minecraft. I used perlin noise and cube objects to generate the world and utilized a quad tree to optimise the collisions between the player and the ground. The world generates infinite terrain for the player to explore at will. I have also implemented a system which allows the player to place and destroy cubes. This uses my implementation of a raycast to determine the face of the cube the player is looking at so the cube is placed correctly. 

#### Features
1. Infinite Terrain Generation Using Perlin Noise
2. Optimised Collision Using a Quad Tree
3. Raycast Face Detection
4. Skybox
5. Basic Lighting
6. AABB and OBB Collision
7. Flying Mode and Physics Based Movement
8. Build and Destroy Cubes
9. Tree Generation

#### Video
<iframe width="560" height="315" src="https://www.youtube.com/embed/JG4Ii_O3zgQ" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>


