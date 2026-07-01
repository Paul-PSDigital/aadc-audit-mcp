import 'package:flutter/material.dart';

/// Account and data tools required under AADC Standard 15.
class DataRightsScreen extends StatelessWidget {
  const DataRightsScreen({super.key});

  Future<void> deleteAccount() async {
    // Permanently removes the account and all associated records.
  }

  Future<void> exportData() async {
    // Lets a child download my data as a portable file.
  }

  void openReport(BuildContext context) {
    // Opens the report a concern route.
    Navigator.of(context).pushNamed('/report');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextButton(onPressed: deleteAccount, child: const Text('Delete account')),
        TextButton(onPressed: exportData, child: const Text('Download my data')),
        TextButton(
          onPressed: () => openReport(context),
          child: const Text('Report a concern'),
        ),
      ],
    );
  }
}
