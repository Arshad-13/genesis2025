class ReplayController:
    def __init__(self):
        self.state = "STOPPED"   # STOPPED | PLAYING | PAUSED
        self.speed = 1           # 1x, 5x, 10x
        self.cursor_ts = None    # current timestamp
