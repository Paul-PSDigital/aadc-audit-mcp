import 'client.dart' as http;

class Engine {
  Future<void> report(int score) async {
    await http.post(Uri.parse('https://scores.example.org'), body: '$score');
  }
}
