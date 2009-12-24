task :default => [:run_tests ]
task :build => [:copy, :compile, :version]
task :build_debug => [:clean, :copy_all, :version]
task :deploy => [:build, :push]
task :deploy_debug => [:build_debug, :push]


FileUtils.mkdir_p "build"

task :run_tests => [:compile_tests] do
  sh "jstdServer ; sleep 3 ; open http://localhost:4224/capture" unless `nc -z localhost 4224` =~ /succeeded!/
  sh "testjstd"
end

task :clean do
  sh "rm -rf build"
end

task :copy do
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

#extract out the js files from recon.html
source = File.read("recon.html")
region_regex = /<!--\s*Begin scripts to compile\s*-->(.*?)<!--\s*End scripts to compile\s*-->/m
scripts_region = region_regex.match(source)[1]
js_files = scripts_region.scan(/src=\"(.*?)\"/).compact.map{|a|a[0]}

libs, src = js_files.partition {|f| f.start_with? "lib/"}

task :compile => [:copy, "build/compiled.js", "build/recon.html"]
task :compile_tests => "build/with_tests_compiled.js"

file "build/recon.html" => "recon.html" do
  new_source = source.sub(region_regex, "<script language=\"javascript\" charset=\"utf-8\" src=\"compiled.js\"></script>")
  File.open("build/recon.html", 'w') {|f| f.write(new_source)}
end

file "build/compiled.js" => ["build/libs_compiled.js", "build/src_compiled.js"] do |t|
  compilejs(t.prerequisites, t.name, "--warning_level QUIET --compilation_level WHITESPACE_ONLY")
end

file "build/libs_compiled.js" => libs do |t|
  compilejs(t.prerequisites, t.name, "--summary_detail_level 0 --warning_level QUIET  --compilation_level WHITESPACE_ONLY")
end

file "build/src_compiled.js" => src + ["src/externs.js"] do |t|
  compilejs(src, t.name, "--externs src/externs.js --summary_detail_level 3 --jscomp_warning=visibility --warning_level VERBOSE")
end


file "build/with_tests_compiled.js" => ["build/libs_compiled.js", "build/src_and_tests_compiled.js"] do |t|
  compilejs(t.prerequisites, t.name, "--summary_detail_level 0 --warning_level QUIET  --compilation_level WHITESPACE_ONLY")
end

file "build/src_and_tests_compiled.js" => src + FileList["test/*.js"] do |t|
  compilejs(t.prerequisites, t.name, "--externs src/externs.js --externs test/externs --warning_level VERBOSE")
end

task :version do
  version = `git log | head -n 1`.match(/commit (.{40})/)[1]
  File.open("build/version",'w'){|f| f.puts(version)}
  File.open("build/version.js",'w'){|f| f.puts("LOADER_VERSION='#{version}';")}
end

task :push do
  sh "scp -q -r server.py build data.labs.freebase.com:/mw/loader/"
end

def compilejs(js_files, output_name, options="")
  js_files_string = js_files.map{|f| "--js #{f}"}.join(" ")
  begin
    sh "compilejs #{js_files_string} #{options} --js_output_file #{output_name}"
  rescue Exception => err
    sh "rm -f #{output_name}"
    throw err
  end
end


#tabulates savings by compiling and by gzipping
task :savings => "build/compiled.js" do
  sh "cat #{js_files.join ' '} > catted.js"
  sh "du -h catted.js"
  sh "gzip catted.js"
  sh "du -h catted.js.gz"
  sh "du -h build/compiled.js"
  sh "cat build/compiled.js | gzip > build/compiled.js.gz"
  sh "du -h build/compiled.js.gz"
  sh "rm catted.js.gz"
  sh "rm build/compiled.js.gz"
end
