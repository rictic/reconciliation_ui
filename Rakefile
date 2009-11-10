task :default => [:run_tests ]
task :build => [:clean, :copy, :compile, :version]
task :build_debug => [:clean, :copy_all, :version]
task :deploy => [:build, :push]
task :deploy_debug => [:build_debug, :push]

task :run_tests do
  sh "jstdServer && sleep 3" unless `nc -z localhost 4224` =~ /succeeded!/
  sh "testjstd"
end

task :clean do
  sh "rm -rf build"
end

task :copy do
  sh "mkdir -p build"
  #copy static resources
  sh "cp COPYRIGHT *.css build/"
  #make sure our other css and images make it
  sh "cp -r lib build/"
  sh "cp -r examples build/"
  sh "cp -r resources build/"
end

task :copy_all => :copy do
  sh "cp -r src build/"
  sh "cp recon.html build/"
end

task :compile => :copy do
  source = File.read("recon.html")
  region_regex = /<!--\s*Begin scripts to compile\s*-->(.*?)<!--\s*End scripts to compile\s*-->/m
  scripts_region = region_regex.match(source)[1]
  script_matcher = /src=\"(.*?)\"/
  js_files = scripts_region.scan(script_matcher).compact
  
  js_files.map! {|f| "--js #{f}"}

  compiled_name = "compiled.js"
  libs, src = js_files.partition {|f| f.start_with? "--js lib/"}
  sh "compilejs #{libs.join " "} --summary_detail_level 0 --third_party true --js_output_file build/libs_compiled.js" #--warning_level QUIET
  sh "compilejs #{src.join " "} --summary_detail_level 3 --js_output_file build/src_compiled.js" #--warning_level VERBOSE
  sh "compilejs --js build/libs_compiled.js --js build/src_compiled.js --js_output_file build/#{compiled_name}"# --compilation_level WHITESPACE_ONLY"

  new_source = source.sub(region_regex, "<script language=\"javascript\" charset=\"utf-8\" src=\"#{compiled_name}\"></script>")
  File.open("build/recon.html", 'w') {|f| f.write(new_source)}
end

task :version do
  version = `git log | head -n 1`.match(/commit (.{40})/)[1]
  File.open("build/version",'w'){|f| f.puts(version)}
  File.open("build/version.js",'w'){|f| f.puts("LOADER_VERSION='#{version}';")}
end

task :push do
  sh "scp -q -r server.py build data.labs.freebase.com:/mw/loader/"
end

