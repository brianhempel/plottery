# Dumps each event to the file `usage_events/url_path`
#
# The usage_events_csv.rb script will conglomerate the events into a CSV, assuming each event is a JSON blob.

require 'fileutils'
require 'webrick'

def add_cors(res)
  res['Access-Control-Allow-Origin'] = '*'
  res['Access-Control-Allow-Headers'] = '*'
end

class MyServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_OPTIONS(req, res)
    add_cors(res)
  end


  def do_POST(req, res)
    add_cors(res)

    puts req.path
    puts req.body

    path = "usage_events#{req.path}"

    FileUtils.mkdir_p(File.dirname(path))

    File.write(path, req.body)

    res.body = "wrote to #{path}"
    res['Content-Type'] = 'text/plain'
  end
end

server = WEBrick::HTTPServer.new(Port: 7777)
server.mount '/', MyServlet
server.start
