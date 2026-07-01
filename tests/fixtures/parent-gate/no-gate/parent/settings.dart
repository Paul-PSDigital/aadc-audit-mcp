// A parent-only settings surface with ordinary code and, deliberately, no
// parent-gate mechanism anywhere in the fixture.

class ParentSettings {
  bool notifications = true;
  double dailyLimitMinutes = 60;

  Widget build() {
    return Column(
      children: [
        Text('Parent settings'),
        Switch(value: notifications, onChanged: (v) => notifications = v),
        Slider(
          value: dailyLimitMinutes,
          min: 0,
          max: 240,
          onChanged: (v) => dailyLimitMinutes = v,
        ),
      ],
    );
  }
}
