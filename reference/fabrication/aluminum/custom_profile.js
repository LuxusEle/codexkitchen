// custom_profile.js

function getCustomProfile(name) {
    let savedProfiles = JSON.parse(localStorage.getItem('customProfiles') || '{}');
    return savedProfiles[name] || null;
}

function generateCustomBar(profileName, length, colorHex, scene, earcut) {
    const profile = getCustomProfile(profileName);
    if (!profile || !profile.points || profile.points.length < 3) {
        // Fallback to a standard box if profile is missing
        return BABYLON.MeshBuilder.CreateBox('fallback', {width: 25, depth: 38, height: length}, scene);
    }

    // Convert 2D points to Babylon Vector2 (X, Y)
    // Points from the editor were in mm, centered at 0,0
    const path2D = profile.points.map(p => new BABYLON.Vector2(p.x / 1000, p.y / 1000));
    
    // Create the polygon mesh
    const polyBuilder = new BABYLON.PolygonMeshBuilder("custom_bar_" + profileName, path2D, scene, earcut);
    
    // Build the mesh with the specified extrusion length
    // PolygonMeshBuilder extrudes along the Y-axis by default
    const mesh = polyBuilder.build(false, length / 1000); 
    
    // Apply material
    const mat = new BABYLON.StandardMaterial("custom_mat_" + profileName, scene);
    mat.diffuseColor = BABYLON.Color3.FromHexString(colorHex || "#81c784");
    mesh.material = mat;
    
    // The MeshBuilder creates it so the extrusion goes from Y=0 to Y=length
    // We want the origin to be consistent with our other bars (which usually have origin at their bottom/left/front corner).
    // Let's compute the bounding box of the 2D profile to understand its dimensions.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    profile.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    
    const profileWidth = maxX - minX;
    const profileDepth = maxY - minY;
    
    // Store metadata on the mesh so we know its bounding box size
    mesh.customProfileData = {
        name: profileName,
        width: profileWidth,
        depth: profileDepth,
        minX: minX,
        minY: minY
    };
    
    // Adjust rotation so it extrudes along Z-axis like normal CreateBox does?
    // Actually, normal CreateBox is centered at 0,0,0.
    // If we use PolygonMeshBuilder, it builds in the XZ plane and extrudes along Y.
    // We'll leave it as is and let the calling function rotate/position it based on orientation.
    return mesh;
}
