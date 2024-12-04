if ARGV == []
  STDERR.puts "Usage: ruby usage_events_csv.rb <directories>"
  STDERR.puts ""
  STDERR.puts "Reads all the files in <directories>, presuming each is a JSON blob representing an event."
  STDERR.puts "Each event is expected to have a 'timestamp' and a 'n' field."
  STDERR.puts "Events are sorted by (timestamp, n) and then output to STDOUT as a CSV, all other fields become CSV columns."
  exit(1)
end
dirs = ARGV

require 'json'
require 'set'

events =
  dirs
    .flat_map { |dir| Dir.glob("#{dir}/*") }
    .map      { |path| JSON.parse(File.read(path)) }
    .sort_by  { |event| [event['timestamp'], event['n']] }

headers = events.flat_map(&:keys).uniq

require 'csv'

puts headers.to_csv
STDERR.puts "Note the headers are not always in the same order between sessions. For this session they are: #{headers}"
events.each do |event|
  puts headers.map { |key| event[key] }.to_csv
end
