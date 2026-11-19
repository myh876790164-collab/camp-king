use strict; use warnings; use utf8;
binmode STDOUT, ':utf8';
# usage: lit.pl file  (reads pairs from STDIN separated by lines "@@OLD", "@@NEW", "@@END")
my $file = shift;
open my $fh, '<:raw', $file or die; local $/; my $s = <$fh>; close $fh;
my $spec = do { local $/; <STDIN> };
my @blocks = split /\n\@\@END\n?/, $spec;
for my $b (@blocks) {
  next unless $b =~ /\S/;
  my ($old, $new) = $b =~ /^\@\@OLD\n(.*?)\n\@\@NEW\n(.*)$/s or die "bad block";
  my $n = () = $s =~ /\Q$old\E/g;
  die "$file: expected 1 match, got $n for: ".substr($old,0,70)."\n" if $n != 1;
  my $i = index($s, $old); substr($s, $i, length($old)) = $new;
}
open my $oh, '>:raw', $file or die; print $oh $s; close $oh; print "ok $file\n";
