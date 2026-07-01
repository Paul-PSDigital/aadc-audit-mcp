// A declared parent-area surface whose route references a guard
// (canActivate: [AuthGuard]), so it is treated as gate-protected.

class Dashboard {
  final routes = [
    {
      'path': '/parent/dashboard',
      'canActivate': ['AuthGuard'],
    },
  ];

  Widget build() {
    return Column(
      children: [
        Text('Parent dashboard'),
        Text('Manage your preferences here.'),
      ],
    );
  }
}
