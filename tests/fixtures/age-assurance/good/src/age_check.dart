import 'package:flutter/material.dart';

/// A simple age gate shown on first launch.
class AgeGate extends StatelessWidget {
  const AgeGate({super.key, required this.dateOfBirth, required this.onResult});

  final DateTime dateOfBirth;
  final void Function(bool isAdult) onResult;

  bool verifyAge(DateTime dob) {
    final now = DateTime.now();
    var years = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      years -= 1;
    }
    return years >= 18;
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () => onResult(verifyAge(dateOfBirth)),
      child: const Text('Continue'),
    );
  }
}
