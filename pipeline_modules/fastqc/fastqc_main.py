
inputFile = "/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_inputs/test_workflow/SP1.fq"
outDir = "/home/ubuntu/Webpage/app_collaborative_sci_workflow/workflow_outputs/test_workflow/"



import subprocess
pipe = subprocess.Popen(["/usr/bin/perl", "/home/ubuntu/Webpage/fastqc_wrapper/FastQC/fastqc", inputFile, "--outdir", outDir , "--extract"]).communicate()







