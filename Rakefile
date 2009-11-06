task :default => [:run_tests ]

task :run_tests do
  sh "jstdServer && sleep 3" unless `nc -z localhost 4224` =~ /succeeded!/
  sh "testjstd"
end

task :compile do
  source = File.read("recon.html")
  region_regex = /<!--\s*Begin scripts to compile\s*-->(.*?)<!--\s*End scripts to compile\s*-->/m
  scripts_region = region_regex.match(source)[1]
  script_matcher = /src=\"(.*?)\"/
  js_files = scripts_region.scan(script_matcher).compact
  
  js_files.map! {|f| "--js #{f}"}
  opts = js_files.join(" ")
  compiled_name = "compiled.js"
  sh "compilejs #{opts} --js_output_file #{compiled_name}"
  new_source = source.sub(region_regex, "<script language=\"javascript\" charset=\"utf-8\" src=\"#{compiled_name}\"></script>")
  File.open("recon-compiled.html", 'w') {|f| f.write(new_source)}
  
  
#   sh "compilejs #{opts} --compilation_level ADVANCED_OPTIMIZATIONS --js_output_file compiled-advanced.js "
end