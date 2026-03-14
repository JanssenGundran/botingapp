import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Voting } from './voting';

describe('Voting', () => {
  let component: Voting;
  let fixture: ComponentFixture<Voting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Voting],
    }).compileComponents();

    fixture = TestBed.createComponent(Voting);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
