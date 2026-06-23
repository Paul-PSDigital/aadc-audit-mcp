class CleanEngine {
  int score(List<int> hits) {
    var total = 0;
    for (final h in hits) {
      total += h * 2;
    }
    return total;
  }
}
