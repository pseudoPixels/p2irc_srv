




import subprocess
pipe = subprocess.Popen(["/usr/bin/perl", "/home/ubuntu/Webpage/fastqc_wrapper/FastQC/fastqc", inputFile, "--outdir", outDir , "--extract"]).communicate()







