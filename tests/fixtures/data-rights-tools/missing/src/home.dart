import 'package:flutter/material.dart';

/// A plain welcome screen. It offers none of the data-rights tools.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Welcome')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text('Hello there!'),
            SizedBox(height: 12),
            Text('Tap a card to start playing.'),
          ],
        ),
      ),
    );
  }
}
