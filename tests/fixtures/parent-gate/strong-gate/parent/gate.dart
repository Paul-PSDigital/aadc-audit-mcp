// A parent gate that exists (an ageGate token) AND poses a strong
// challenge a young child cannot trivially pass: a free-text birth-year
// question wired to a TextField.

class AgeGate {
  final yearController = TextEditingController();

  Widget build() {
    return Column(
      children: [
        Text('What year were you born?'),
        TextField(controller: yearController),
        ElevatedButton(
          onPressed: () => verifyBirthYear(yearController.text),
          child: Text('Verify'),
        ),
      ],
    );
  }
}
