This directory contains predefined NiCad configuration files
for standard type 1, 2 and 3 clones with or without HTML reports
and other example configurations.  To use a configuration, in the
parent directory of this directory (the main NiCad directory)
run the nicad4 command:

	nicad4 functions c systemdir type1

where "functions" is the clone granularity you wish, "c" is the
language, "systemdir" is the root directory of the source
code for the system you want to proces, and "type1" is the name
of the configuration you want to use (in this case "type1.cfg".).

To make your own configuration, copy default.cfg to myconfig.cfg 
and edit the options as you wish, then run the command above with
"myconfig" in place of "type1".

The configurations that end in "report" ask NiCad to generate
human-readable HTML web page reports with original source for each
cloned source fragment.
