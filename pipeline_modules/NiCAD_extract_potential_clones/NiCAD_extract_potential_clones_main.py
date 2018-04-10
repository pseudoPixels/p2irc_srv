
import subprocess

pipe = subprocess.Popen(
    ["/bin/bash", "/home/ubuntu/Webpage/app_collaborative_sci_workflow/External_Libraries/NiCad-4.0/scripts/Extract",
     granularity, language,
     system_directory, select_pattern, ignore_pattern,
     "/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/test_workflow/"]).communicate()

