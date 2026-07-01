// A declared parent-area surface that references no parent gate and no
// route-guard, so it may be reachable directly. Deliberately avoids every
// gate/guard token (including the substring "gate", so no Navigator /
// navigate calls appear here).

class Dashboard {
  Widget build() {
    return Column(
      children: [
        Text('Parent dashboard'),
        Text('Manage your preferences here.'),
        ListTile(title: Text('Screen time')),
        ListTile(title: Text('Notifications')),
      ],
    );
  }
}
