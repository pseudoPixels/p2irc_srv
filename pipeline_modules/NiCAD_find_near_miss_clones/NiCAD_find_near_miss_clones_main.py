
import subprocess

pipe = subprocess.Popen(
    ["/bin/bash",
     "/home/ubuntu/Webpage/app_collaborative_sci_workflow/External_Libraries/NiCad-4.0/scripts/FindClonePairs",
     potential_clones, str(threshold),
     str(minCloneSize), str(maxCloneSize),
     near_miss_clones]).communicate()

