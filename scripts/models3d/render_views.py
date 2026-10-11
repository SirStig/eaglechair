import bpy, sys, math
from mathutils import Vector
glb, out, *angs = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.samples=48; sc.cycles.use_denoising=True
sc.render.resolution_x=520; sc.render.resolution_y=720
sc.view_settings.view_transform='AgX'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.6
for loc,e,s in [((2,-3,4),400,3),((-3,-1,2),150,3),((0,3,3),150,3)]:
    l=bpy.data.objects.new('l',bpy.data.lights.new('l','AREA')); l.data.energy=e; l.data.size=s; l.location=loc
    l.rotation_euler=(Vector((0,0,0.5))-Vector(loc)).to_track_quat('-Z','Y').to_euler(); sc.collection.objects.link(l)
bpy.ops.mesh.primitive_plane_add(size=10); 
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); cam.data.lens=70; sc.collection.objects.link(cam); sc.camera=cam
ctr=Vector((0,0,0.47))
for i,a in enumerate(angs):
    a,el=[float(x) for x in a.split(':')]
    t=math.radians(a); cam.location=ctr+Vector((math.cos(t)*math.cos(math.radians(el)),math.sin(t)*math.cos(math.radians(el)),math.sin(math.radians(el))))*3.3
    cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=f"{out}_{i}.png"; bpy.ops.render.render(write_still=True)
