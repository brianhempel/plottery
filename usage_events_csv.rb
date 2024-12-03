dir = ARGV[0] || STDERR.puts("Usage: ruby usage_events_csv.rb <path>") || exit(1)

require 'json'
require 'set'

events =
  Dir.glob("#{dir}/*")
    .map     { |path| JSON.parse(File.read(path)) }
    .sort_by { |event| [event['timestamp'], event['n']] }

headers = events.flat_map(&:keys).uniq

require 'csv'

puts headers.to_csv
STDERR.puts "Note the headers are not always in the same order between sessions. For this session they are: #{headers}"
events.each do |event|
  puts headers.map { |key| event[key] }.to_csv
end
