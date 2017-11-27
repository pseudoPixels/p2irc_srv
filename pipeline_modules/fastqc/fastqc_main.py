
import subprocess
pipe = subprocess.Popen(["perl", "fastqc", inputFile, "--outdir", outDir , "--extract"]).communicate()


