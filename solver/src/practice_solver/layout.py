"""Canvas layout of the product's Net the Numbers screen, in CSS pixels.

Read off five saved pages. The pitch is a cell plus its gap; a net's artwork
starts one tenth of a pitch left of and above the cell it covers. Every marker
is checked against this lattice, so a renderer change fails loudly instead of
quietly landing numbers on the wrong cell.
"""

NET_LAYOUT = {"left": 36.5333, "top": 172.933, "pitch": 70.611, "size": 56.4889, "pad": 7.061, "n": 5}
LAYOUT_TOLERANCE = 1.0
