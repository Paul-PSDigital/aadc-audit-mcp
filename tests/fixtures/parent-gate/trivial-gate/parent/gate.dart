// A parent gate that exists (an ageGate token) but is trivially
// bypassable: a single tap on an "I am over 18" affirmation, with no
// strong challenge (no birth-year, no age entry, no arithmetic, no
// TextField) anywhere in the fixture.

class AgeGate {
  Widget build() {
    return Column(
      children: [
        Text('Before you continue'),
        ElevatedButton(
          onPressed: () => openParentSettings(),
          child: Text('I am over 18'),
        ),
      ],
    );
  }
}
