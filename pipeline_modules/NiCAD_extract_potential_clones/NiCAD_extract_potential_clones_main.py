
import subprocess

pipe = subprocess.Popen(
    ["/bin/bash", "/home/ubuntu/Webpage/app_collaborative_sci_workflow/External_Libraries/NiCad-4.0/scripts/Extract",
     granularity, language,
     system_directory, select_pattern, ignore_pattern,
     output_destination]).communicate()

