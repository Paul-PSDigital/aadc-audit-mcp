import 'package:just_audio/just_audio.dart';
import 'package:url_launcher/url_launcher.dart';

class Player {
  final p = AudioPlayer();

  Future<void> load() async {
    await p.setUrl('https://hardcoded.example.org/manifest');
  }

  Future<void> openHelp() async {
    await launchUrl(Uri.parse('https://help.example.org'));
  }
}
