task :default => [:test]
task :test => [:compile_tests, :run_tests]

task :build => [:copy, :compile, :version]
#i.e. don't compile, just copy
task :build_debug => [:clean, :copy_all, :version]

task :deploy => [:clean, :build, :push, :clean_again]
task :deploy_debug => [:clean, :build_debug, :compile_tests, :push, :clean_again]
task :deploy_dev => [:clean, :build_debug, :compile_tests, :push_dev, :clean_again]

file "build/" do
  sh "mkdir -p build"
end

task :run_tests => "jsTestDriver.conf" do
  sh "jstdServer ; sleep 3 ; open http://localhost:4224/capture" unless `nc -z localhost 4224` =~ /succeeded!/
  sh "testjstd"
end

task :clean do
  sh "rm -rf build"
  sh "rm -f .jsTestDriver.conf"
end

task :clean_again do
  sh "rm -rf build"
end

task :copy => "build/" do
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

task :compile => [:copy, "build/", "build/compiled.js", "build/recon.html"]

#this file isn't used, it just gives the compiler a chance to catch errors before we even run tests
task :compile_tests => ["build/", "build/src_and_tests_compiled.js"]

file "build/recon.html" => ["build/", "recon.html"] do
  new_source = source.sub(region_regex, "<script charset=\"utf-8\" src=\"compiled.js\"></script>")
  File.open("build/recon.html", 'w') {|f| f.write(new_source)}
end

file "build/compiled.js" => ["build/libs_compiled.js", "build/src_compiled.js"] do |t|
  compilejs(t.prerequisites, t.name, true)
end

file "build/libs_compiled.js" => libs do |t|
  compilejs(t.prerequisites, t.name, true)
end

#externs files for libraries
lib_externs = ["src/externs.js", "lib/jquery.externs.js", "lib/jsobjdump.externs.js", "lib/isISO8601.externs.js"]

file "build/src_compiled.js" => src + lib_externs do |t|
  compilejs(src, t.name, false, lib_externs)
end

file "build/src_and_tests_compiled.js" => src + FileList["test/*.js"] do |t|
  compilejs(t.prerequisites, t.name, false, lib_externs + ['test/externs'])
end

file "jsTestDriver.conf" => "recon.html" do
  contents = "server: http://localhost:4224\n\nload:\n"
  contents += (js_files + ["test/*.js"]).map {|f| " - #{f}"}.join("\n")
  File.open("jsTestDriver.conf", 'w') {|f| f.write(contents)}
end

task :version do
  version = `git log | head -n 1`.match(/commit (.{40})/)[1]
  File.open("build/version",'w'){|f| f.puts(version)}
  File.open("build/version.js",'w'){|f| f.puts("LOADER_VERSION='#{version}';")}
end

task :push do
  push "/mw/loader/"
end

task :push_dev do
  push "/mw/loader_dev/"
end

def push(target)
  sh "scp -q -r server.py build data.labs.freebase.com:#{target}"
end

def compilejs(js_files, output_name, third_party=false, externs=[])
  if (third_party)
    options= "--third_party --summary_detail_level 0 --warning_level QUIET  --compilation_level WHITESPACE_ONLY"
  else
    options= "--summary_detail_level 3 --jscomp_warning=visibility --jscomp_warning=checkVars --jscomp_error=deprecated --jscomp_warning=fileoverviewTags --jscomp_warning=invalidCasts --jscomp_error=nonStandardJsDocs --jscomp_error=undefinedVars --jscomp_error=unknownDefines --warning_level VERBOSE"
  end
  js_files_string = js_files.map{|f| "--js #{f}"}.join(" ")
  externs_string = externs.map{|f| "--externs #{f}"}.join(" ")
  begin
    sh "compilejs #{js_files_string} #{externs_string} #{options} --js_output_file #{output_name}"
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
