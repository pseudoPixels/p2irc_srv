
import subprocess

pipe = subprocess.Popen(
    ["/bin/bash", "/home/ubuntu/Webpage/app_collaborative_sci_workflow/External_Libraries/NiCad-4.0/scripts/Abstract",
     granularity, language,
     input_source, abstraction,
     output_destination]).communicate()

