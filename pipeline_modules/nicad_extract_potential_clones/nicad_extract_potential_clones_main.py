
import subprocess

pipe = subprocess.Popen(
    ["/bin/bash", "/home/ubuntu/Webpage/app_collaborative_sci_workflow/External_Libraries/NiCad-4.0/scripts/Extract",
     "functions", "java",
     '/home/ubuntu/Webpage/app_collaborative_sci_workflow/Dataset/open_source_projects/JHotDraw54b1', "", "",
     "/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/test_workflow/"]).communicate()

