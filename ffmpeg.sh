ffmpeg -framerate 60 -pattern_type glob -i 'output/project/*.jpeg' \
  -c:v libx264 -pix_fmt yuv420p output/video.mp4
