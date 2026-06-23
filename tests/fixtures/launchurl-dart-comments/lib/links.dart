import 'package:url_launcher/url_launcher.dart';

class Links {
  void safe() {
    openSafeKidFacingLink('/help'); // do NOT use launchUrl(uri) here
    final y = 1; /* never call launchUrl(uri) in kid code */
  }

  void unsafe() {
    launchUrl(Uri.parse('https://example.org'));
  }
}
