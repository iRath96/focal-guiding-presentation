$METHODS = ["MCVCM", "MEMLT", "Ours", "PAVMM", "PT", "Reference"]

def crop(scene, off_x, off_y)
    $METHODS.each do |method|
        `convert #{scene}/#{method}.png -crop 96x96+#{off_x}+#{off_y} -filter point -resize 500% #{scene}/#{method}_crop.png`
    end
end

crop "camera-obscura", 880, 370
