"""Errors shared by the snapshot readers."""


class SnapshotError(ValueError):
    """A captured page or image is not a board this package can read."""
