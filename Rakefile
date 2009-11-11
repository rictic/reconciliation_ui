task :default => [:run_tests ]
task :build => [:copy, :compile, :version]
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

source = File.read("recon.html")
region_regex = /<!--\s*Begin scripts to compile\s*-->(.*?)<!--\s*End scripts to compile\s*-->/m
scripts_region = region_regex.match(source)[1]
script_matcher = /src=\"(.*?)\"/
js_files = scripts_region.scan(script_matcher).compact.map{|a|a[0]}
libs, src = js_files.partition {|f| f.start_with? "lib/"}

task :compile => [:copy, "build/compiled.js", "build/recon.html"]

file "build/recon.html" => "recon.html" do
  new_source = source.sub(region_regex, "<script language=\"javascript\" charset=\"utf-8\" src=\"compiled.js\"></script>")
  File.open("build/recon.html", 'w') {|f| f.write(new_source)}
end

file "build/compiled.js" => ["build/libs_compiled.js", "build/src_compiled.js"] do
  sh "compilejs --js build/libs_compiled.js --js build/src_compiled.js --warning_level QUIET --js_output_file build/compiled.js --compilation_level WHITESPACE_ONLY"
end

def format_for_compilejs(src_files) 
  src_files.map{|f| "--js #{f}"}.join(" ")
end


file "build/libs_compiled.js" => libs do
  l = format_for_compilejs(libs)
  sh "compilejs #{l} --summary_detail_level 0 --warning_level QUIET  --compilation_level WHITESPACE_ONLY --js_output_file build/libs_compiled.js"
end

file "build/src_compiled.js" => src do
  s = format_for_compilejs(src)
  sh "compilejs #{s} --externs src/externs.js --summary_detail_level 3 --warning_level VERBOSE --js_output_file build/src_compiled.js"
end

task :version do
  version = `git log | head -n 1`.match(/commit (.{40})/)[1]
  File.open("build/version",'w'){|f| f.puts(version)}
  File.open("build/version.js",'w'){|f| f.puts("LOADER_VERSION='#{version}';")}
end

task :push do
  sh "scp -q -r server.py build data.labs.freebase.com:/mw/loader/"
end

