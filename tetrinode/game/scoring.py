def _calc_level(start_level, lines_cleared_total, progression="fixed"):
    start = max(1, min(15, int(start_level)))
    if progression == "variable":
        remaining = int(lines_cleared_total)
        level = start
        while level < 15:
            goal = 5 * level
            if remaining < goal:
                break
            remaining -= goal
            level += 1
        return max(1, min(15, level))
    return max(1, min(15, start + int(lines_cleared_total // 10)))


def _lines_to_next_level(level, lines_total, progression="fixed", start_level=1):
    if level >= 15:
        return 0.0
    if progression == "variable":
        remaining = float(lines_total)
        lvl = max(1, min(15, int(start_level)))
        while lvl < 15 and remaining >= 5 * lvl:
            remaining -= 5 * lvl
            lvl += 1
        if lvl >= 15:
            return 0.0
        return max(0.0, float(5 * lvl - remaining))
    start = max(1, min(15, int(start_level)))
    lines_into_level = float(lines_total) - float((level - start) * 10)
    return max(0.0, float(10 - lines_into_level))


def _score_action(level, lines_cleared, tspin_type, b2b_active):
    base = 0
    qualifies_b2b = False
    if tspin_type == "tspin":
        if lines_cleared == 0:
            base = 400 * level
        elif lines_cleared == 1:
            base = 800 * level
            qualifies_b2b = True
        elif lines_cleared == 2:
            base = 1200 * level
            qualifies_b2b = True
        elif lines_cleared == 3:
            base = 1600 * level
            qualifies_b2b = True
    elif tspin_type == "mini":
        if lines_cleared == 0:
            base = 100 * level
        else:
            base = 200 * level
            qualifies_b2b = True
    else:
        if lines_cleared == 1:
            base = 100 * level
        elif lines_cleared == 2:
            base = 300 * level
        elif lines_cleared == 3:
            base = 500 * level
        elif lines_cleared == 4:
            base = 800 * level
            qualifies_b2b = True

    bonus = 0
    next_b2b = b2b_active
    if qualifies_b2b:
        if b2b_active:
            bonus = int(base * 0.5)
        next_b2b = True
    elif lines_cleared in {1, 2, 3}:
        next_b2b = False

    return base + bonus, next_b2b


def _awarded_goal_lines(lines_cleared, tspin_type, b2b_active):
    base = 0.0
    qualifies_b2b = False
    if tspin_type == "tspin":
        if lines_cleared == 0:
            base = 4.0
        elif lines_cleared == 1:
            base = 8.0
            qualifies_b2b = True
        elif lines_cleared == 2:
            base = 12.0
            qualifies_b2b = True
        elif lines_cleared == 3:
            base = 16.0
            qualifies_b2b = True
    elif tspin_type == "mini":
        if lines_cleared == 0:
            base = 1.0
        else:
            base = 2.0
            qualifies_b2b = True
    else:
        if lines_cleared == 1:
            base = 1.0
        elif lines_cleared == 2:
            base = 3.0
        elif lines_cleared == 3:
            base = 5.0
        elif lines_cleared == 4:
            base = 8.0
            qualifies_b2b = True
    if qualifies_b2b and b2b_active and base > 0:
        base += base * 0.5
    return base


def _update_stats(state, lines_cleared):
    if lines_cleared > 0:
        state["combo_streak"] = state.get("combo_streak", 0) + 1
        if state["combo_streak"] == 2:
            state["combo_total"] = state.get("combo_total", 0) + 1
        if lines_cleared == 4:
            state["tetrises"] = state.get("tetrises", 0) + 1
        if state.get("tspin") != "none":
            state["tspins"] = state.get("tspins", 0) + 1
    else:
        state["combo_streak"] = 0

